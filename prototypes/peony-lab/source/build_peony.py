"""Deterministic peony study. Run with Blender 5.1 --background --python.
All topology, UVs, random variation and materials are fixed across the bloom.
Only the vertex positions change; no image morphing or rigid petal hinges.
"""
import bpy, math, random, sys, argparse, json
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--poses',default='0,0.5,1')
parser.add_argument('--size',type=int,default=640)
parser.add_argument('--samples',type=int,default=32)
parser.add_argument('--sequence',type=int,default=0)
parser.add_argument('--save-blend',action='store_true')
parser.add_argument('--cpu',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
rng=random.Random(271026)
TAU=math.tau

def clamp(x):return max(0,min(1,x))
def ease(x):
 x=clamp(x);return x*x*x*(x*(x*6-15)+10)
def mix(a,b,t):return a+(b-a)*t

def point_at(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=args.samples
scene.cycles.use_denoising=True
scene.cycles.seed=27
scene.cycles.use_animated_seed=False
scene.cycles.max_bounces=7
scene.cycles.diffuse_bounces=4
scene.cycles.transmission_bounces=4
scene.render.use_persistent_data=True
scene.render.resolution_x=scene.render.resolution_y=args.size
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.render.fps=24
scene.frame_start=1;scene.frame_end=193
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
scene.view_settings.exposure=.35
if not args.cpu:
 prefs=bpy.context.preferences.addons['cycles'].preferences
 prefs.compute_device_type='METAL';prefs.refresh_devices()
 for d in prefs.devices:d.use=d.type=='METAL'
 scene.cycles.device='GPU'
 print('RENDER DEVICES',[(d.name,d.use) for d in prefs.devices],flush=True)
world=bpy.data.worlds.new('Soft studio ambience');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.84,.87,1,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.32
scene.world=world

# Petal pigment follows immutable UVs, never world coordinates.
def material(variant):
 m=bpy.data.materials.new(f'Living blush {variant+1}');m.use_nodes=True
 n=m.node_tree.nodes;l=m.node_tree.links;n.clear()
 def node(typ,name):
  v=n.new(typ);v.label=name;return v
 uv=node('ShaderNodeTexCoord','Stable petal UV')
 sep=node('ShaderNodeSeparateXYZ','Base to tip');l.new(uv.outputs['UV'],sep.inputs[0])
 grad=node('ShaderNodeValToRGB','Rose base and pale rim')
 cr=grad.color_ramp
 cr.elements.remove(cr.elements[1])
 colors=[(0,(.34,.075,.13,1)),(.27,(.65,.23,.34,1)),(.70,(.83,.39,.49,1)),(1,(.96,.64,.68,1))]
 for i,(pos,col) in enumerate(colors):
  e=cr.elements[0] if i==0 else cr.elements.new(pos);e.position=pos
  shift=(variant-2)*.012;e.color=(col[0],max(0,col[1]+shift),max(0,col[2]+shift),1)
 l.new(sep.outputs['Y'],grad.inputs[0])
 mapping=node('ShaderNodeVectorMath','Fine longitudinal fiber scale');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(115,5,1);l.new(uv.outputs['UV'],mapping.inputs[0])
 fibers=node('ShaderNodeTexNoise','Veins bound to the petal');fibers.inputs['Scale'].default_value=1;fibers.inputs['Detail'].default_value=3;fibers.inputs['Roughness'].default_value=.66;l.new(mapping.outputs[0],fibers.inputs['Vector'])
 pigment=node('ShaderNodeMixRGB','Delicate vein pigmentation');pigment.blend_type='MULTIPLY';pigment.inputs[0].default_value=.18;l.new(grad.outputs['Color'],pigment.inputs[1]);l.new(fibers.outputs['Fac'],pigment.inputs[2])
 bump=node('ShaderNodeBump','Microscopic vein relief');bump.inputs['Strength'].default_value=.22;bump.inputs['Distance'].default_value=.012;l.new(fibers.outputs['Fac'],bump.inputs['Height'])
 bs=node('ShaderNodeBsdfPrincipled','Soft translucent tissue');l.new(pigment.outputs[0],bs.inputs['Base Color']);l.new(bump.outputs['Normal'],bs.inputs['Normal'])
 bs.inputs['Roughness'].default_value=.48
 bs.inputs['Specular IOR Level'].default_value=.25
 bs.inputs['Subsurface Weight'].default_value=.23
 bs.inputs['Subsurface Radius'].default_value=(1,.38,.22)
 bs.inputs['Subsurface Scale'].default_value=.055
 bs.inputs['Sheen Weight'].default_value=.14
 bs.inputs['Sheen Roughness'].default_value=.65
 trans=node('ShaderNodeBsdfTranslucent','Thin petal backlighting');l.new(pigment.outputs[0],trans.inputs[0])
 shader=node('ShaderNodeMixShader','Diffuse transmission');shader.inputs[0].default_value=.12;l.new(bs.outputs[0],shader.inputs[1]);l.new(trans.outputs[0],shader.inputs[2])
 output=node('ShaderNodeOutputMaterial','Surface');l.new(shader.outputs[0],output.inputs['Surface'])
 return m
mats=[material(i) for i in range(5)]

# Arc-length spine integration means opening changes curvature, not scale.
# Cross-petal curvature relaxes as the petal opens. Crown is a rounded arch,
# never a triangular tip. Phases are fixed per petal, not sampled per frame.
ROWS,COLS=36,24
rings=[
 dict(n=9,L=2.65,w=.78,r=.19,z=.00,start=0,end=.48,angle=2.30),
 dict(n=11,L=2.44,w=.69,r=.17,z=.10,start=.08,end=.62,angle=2.04),
 dict(n=13,L=2.16,w=.58,r=.14,z=.20,start=.22,end=.76,angle=1.72),
 dict(n=14,L=1.86,w=.47,r=.12,z=.29,start=.36,end=.88,angle=1.40),
 dict(n=15,L=1.54,w=.38,r=.10,z=.37,start=.48,end=.97,angle=1.12),
 dict(n=13,L=1.24,w=.29,r=.08,z=.45,start=.59,end=1,angle=.91),
]
petals=[]

def coordinates(spec,progress):
 ring=spec['ring'];phase=spec['phase']
 start=max(0,ring['start']+phase);end=min(1,ring['end']+phase)
 local=ease((progress-start)/(end-start))
 L=spec['L'];width=spec['w'];az=spec['az'];seed=spec['seed']
 # Calculate 160 arc-length samples, then lookup the spine per vertex.
 steps=160;rad=[ring['r']];height=[ring['z']];angles=[]
 for i in range(steps+1):
  s=i/steps
  closed=1.01-2.48*s**1.32 + spec['tilt']*.25
  # Unrolling wave: distal curvature releases after the base begins bending.
  wave=ease(clamp(local*1.23-.23*s))
  opened=.38+(ring['angle']-.38)*s**1.12+spec['tilt']
  ang=mix(closed,opened,wave)
  angles.append(ang)
  if i:
   a=(ang+angles[i-1])/2
   rad.append(rad[-1]+math.sin(a)*L/steps)
   height.append(height[-1]+math.cos(a)*L/steps)
 def spine(t):
  k=min(steps-1,int(t*steps));f=t*steps-k
  return mix(rad[k],rad[k+1],f),mix(height[k],height[k+1],f),mix(angles[k],angles[k+1],f)
 verts=[]
 for j in range(ROWS+1):
  t=j/ROWS
  profile=(.018+.982*math.sin(math.pi*.5*t)**.85)*(1-.12*t)
  for k in range(COLS+1):
   u=k/COLS*2-1
   # Broad arched top, shallow asymmetric notches, ruffled perimeter.
   s=t*(1-.22*abs(u)**2.3)
   s+=t**7*(.012*math.sin(11*u+seed)+.008*math.sin(23*u+2*seed))
   s=clamp(s)
   r,z,a=spine(s)
   wrap=mix(1.12,.48,local)
   side=width*profile*math.sin(u*wrap)/math.sin(wrap)
   cup=-width*profile*(1-math.cos(u*wrap))/math.sin(wrap)
   edge=abs(u)**5
   crest=t**7
   # Ruffles are actual surface geometry and retain material coordinates.
   ripple=(.025+.025*local)*profile*(.45*edge+crest)*(math.sin(15*u+seed+3*t)+.44*math.sin(31*u-2*seed+6*t))
   ripple+=.012*profile*math.sin(8*u+5*t+seed)*(t*.8+edge*.2)
   normal=cup+ripple
   # Normal to the meridional spine; transverse cup and ruffles bend with it.
   r+=normal*math.cos(a);z-=normal*math.sin(a)
   z+=spec['twist']*u*profile*t
   side+=.045*math.sin(t*3+seed)*t*t
   x=r*math.cos(az)-side*math.sin(az)
   y=r*math.sin(az)+side*math.cos(az)
   verts.append((x,y,z))
 return verts

faces=[]
for j in range(ROWS):
 for k in range(COLS):
  a=j*(COLS+1)+k;b=a+COLS+1
  faces.append((a,a+1,b+1,b))
for ri,ring in enumerate(rings):
 for i in range(ring['n']):
  spec=dict(ring=ring,L=ring['L']*rng.uniform(.94,1.055),w=ring['w']*rng.uniform(.88,1.12),az=TAU*(i+.43*(ri%2))/ring['n']+ri*.37+rng.uniform(-.065,.065),phase=rng.uniform(-.025,.025),tilt=rng.uniform(-.10,.10),twist=rng.uniform(-.065,.065),seed=rng.uniform(0,TAU))
  mesh=bpy.data.meshes.new(f'Petal topology {ri:02}-{i:02}');mesh.from_pydata(coordinates(spec,0),[],faces);mesh.update()
  obj=bpy.data.objects.new(f'Petal {ri+1}.{i+1:02}',mesh);scene.collection.objects.link(obj)
  obj.data.materials.append(mats[rng.randrange(len(mats))])
  uv=mesh.uv_layers.new(name='Petal coordinates')
  for poly in mesh.polygons:
   poly.use_smooth=True
   for li in poly.loop_indices:
    vi=mesh.loops[li].vertex_index;uv.data[li].uv=((vi%(COLS+1))/COLS,(vi//(COLS+1))/ROWS)
  sub=obj.modifiers.new('Soft continuous surface','SUBSURF');sub.levels=1;sub.render_levels=1
  solid=obj.modifiers.new('Tissue thickness','SOLIDIFY');solid.thickness=.005;solid.offset=0
  obj['layer']=ri+1;obj['identity']=f'{ri+1}.{i+1:02}'
  petals.append((obj,spec))
print(f'BUILT {len(petals)} persistent deformable petals',flush=True)

# A restrained, physically present center, revealed by occlusion.
def simple_mat(name,color,rough=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1)
 m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=rough
 return m
filmat=simple_mat('Warm cream filaments',(.68,.40,.12))
tipmat=simple_mat('Muted pollen gold',(.83,.50,.09))
for i in range(45):
 a=rng.random()*TAU;r=.10+.17*math.sqrt(rng.random())
 curve=bpy.data.curves.new('Filament','CURVE');curve.dimensions='3D';curve.bevel_depth=.009;curve.bevel_resolution=2
 sp=curve.splines.new('BEZIER');sp.bezier_points.add(2)
 points=[(r*.5*math.cos(a),r*.5*math.sin(a),.48),(r*.8*math.cos(a),r*.8*math.sin(a),.68),(r*math.cos(a),r*math.sin(a),.78+rng.random()*.13)]
 for bp,co in zip(sp.bezier_points,points):bp.co=co;bp.handle_left_type=bp.handle_right_type='AUTO'
 ob=bpy.data.objects.new('Stamen filament',curve);scene.collection.objects.link(ob);curve.materials.append(filmat)
 bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=6,radius=.025,location=points[-1]);tip=bpy.context.object;tip.name='Pollen anther';tip.scale=(.65,1,1.5);tip.data.materials.append(tipmat)
 for poly in tip.data.polygons:poly.use_smooth=True

for name,loc,power,size,color in [
 ('Large soft key',(-3,-4,6),650,4.0,(1,.89,.84)),
 ('Cool soft fill',(4,-2,3),220,4.0,(.88,.93,1)),
 ('Translucent rim',(-1,3,5),500,3.0,(1,.93,.89))]:
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
 ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;point_at(ob,(0,0,1))
camdata=bpy.data.cameras.new('Fixed botanical camera');camera=bpy.data.objects.new('Fixed botanical camera',camdata);scene.collection.objects.link(camera)
camera.location=(.15,-8,6);point_at(camera,(0,0,1));camdata.type='ORTHO';camdata.ortho_scale=5.7;scene.camera=camera

controller=bpy.data.objects.new('BLOOM • progress',None);scene.collection.objects.link(controller);controller['progress']=0.0
controller.id_properties_ui('progress').update(min=0.0,max=1.0,description='0 closed, 1 open. Same petals throughout.')

def pose(p):
 for obj,spec in petals:
  coords=coordinates(spec,p)
  obj.data.vertices.foreach_set('co',[v for xyz in coords for v in xyz]);obj.data.update()
 controller['progress']=p
 bpy.context.view_layer.update()

# Optional portable animation: absolute shape keys bake the same deformation.
# The .blend plays without a script, external textures, or auto-execution.
if args.save_blend:
 for obj,spec in petals:
  for ki in range(25):
   key=obj.shape_key_add(name=f'Pose {ki/24:.3f}')
   key.interpolation='KEY_LINEAR'
   key.data.foreach_set('co',[v for xyz in coordinates(spec,ki/24) for v in xyz])
  keys=obj.data.shape_keys;keys.use_relative=False
  driver=keys.driver_add('eval_time').driver;driver.type='SCRIPTED';driver.expression='bloom * 240'
  var=driver.variables.new();var.name='bloom';var.type='SINGLE_PROP';var.targets[0].id=controller;var.targets[0].data_path='["progress"]'
 controller['progress']=0.;controller.keyframe_insert(data_path='["progress"]',frame=1)
 controller['progress']=1.;controller.keyframe_insert(data_path='["progress"]',frame=193)
 scene.frame_set(97)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'peony.blend'))
 # Remove keys in the render session so analytic samples remain exact.
 for obj,spec in petals:obj.shape_key_clear()
 controller.animation_data_clear()

(ROOT/'previews').mkdir(exist_ok=True);(ROOT/'frames').mkdir(exist_ok=True)
if args.sequence:
 poses=[i/(args.sequence-1) for i in range(args.sequence)]
else:poses=[float(s) for s in args.poses.split(',')]
for i,p in enumerate(poses):
 pose(p)
 path=ROOT/('frames' if args.sequence else 'previews')/(f'frame-{i:03}.png' if args.sequence else f'pose-{round(p*100):03}.png')
 scene.render.filepath=str(path)
 print(f'RENDER {i+1}/{len(poses)} progress={p:.4f} -> {path}',flush=True)
 bpy.ops.render.render(write_still=True)
if args.sequence:
 (ROOT/'frames'/'manifest.json').write_text(json.dumps(dict(count=len(poses),size=args.size,petals=len(petals),duration=8,format='png',generator='Blender Cycles; fixed topology and UVs; analytic surface deformation'),indent=2))
print('DONE',flush=True)
