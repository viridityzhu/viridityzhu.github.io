"""Rebuild the editable duck, website mesh, and transparent fallback.

Run with Blender in background mode:
  blender -b --factory-startup --python-exit-code 1 --python _art/duck/build.py
"""

import math
import random
import struct
from pathlib import Path

import bpy
from mathutils import Vector

SOURCE = Path(__file__).resolve().parent
SITE = SOURCE.parents[1]
randomizer = random.Random(23)
parts = []


def material(name, rgb):
    mat = bpy.data.materials.new(name)
    linear = tuple(c / 255 / 12.92 if c < 11 else ((c / 255 + 0.055) / 1.055) ** 2.4
                   for c in rgb)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = 0.83
    mat["web_color"] = rgb
    return mat


def finish(obj, name, paint):
    obj.name = name
    obj.data.materials.append(paint)
    parts.append(obj)
    return obj


def pebble(name, center, radii, paint, angles=(0, 0, 0), rough=0.07, subdivisions=2, head=False):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, location=center)
    obj = bpy.context.object
    obj.rotation_euler = angles
    obj["moves_with_head"] = head
    for vertex in obj.data.vertices:
        vertex.co *= randomizer.uniform(1 - rough, 1 + rough)
        for axis, radius in enumerate(radii):
            vertex.co[axis] *= radius
    return finish(obj, name, paint)


def bill(name, rings, paint):
    """Loft irregular oval cross-sections from the bill tip toward the face."""
    sides = 10
    verts = []
    for y, x, z, width, height in rings:
        for index in range(sides):
            angle = 2 * math.pi * index / sides
            jitter = randomizer.uniform(0.94, 1.06)
            verts.append((x + math.cos(angle) * width * jitter, y,
                          z + math.sin(angle) * height * jitter))
    faces = [tuple(range(sides))]
    for ring in range(len(rings) - 1):
        start = ring * sides
        for index in range(sides):
            a = start + index
            b = start + (index + 1) % sides
            faces.extend(((a, a + sides, b), (b, a + sides, b + sides)))
    faces.append(tuple(reversed(range(len(verts) - sides, len(verts)))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj["moves_with_head"] = True
    return finish(obj, name, paint)


def export_mesh():
    # Each triangle corner packs XYZ at 1/4096 unit, signed normals, sRGB, and a neck weight.
    # Change from Blender Z-up to WebGL Y-up while preserving handedness.
    output = bytearray()
    for obj in parts:
        mesh = obj.data
        mesh.calc_loop_triangles()
        transform = obj.matrix_world
        rotation = transform.to_3x3()
        color = list(mesh.materials[0]["web_color"])
        for triangle in mesh.loop_triangles:
            nx, ny, nz = (rotation @ triangle.normal).normalized()
            normal = tuple(round(value * 127) for value in (nx, nz, -ny))
            tint = randomizer.uniform(0.97, 1.015)
            face_color = tuple(min(255, round(channel * tint)) for channel in color)
            for index in triangle.vertices:
                x, y, z = transform @ mesh.vertices[index].co
                position = tuple(round(value * 4096) for value in (x, z - 1.04, -y - 0.18))
                weight = 255 if obj.get("moves_with_head") else 0
                if obj == neck:
                    weight = round(255 * max(0, min(1, (z - 1.03) / 0.42)))
                output.extend(struct.pack("<3h3b4Bx", *position, *normal, *face_color, weight))
    (SITE / "assets/3d/duck-mascot-rig.mesh").write_bytes(output)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def light(name, center, power, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = power
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    aim(obj, (0, 0, 1))


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
gold = material("Canary yellow", (255, 207, 14))
wing = material("Warm yellow", (255, 189, 11))
orange = material("Tangerine", (255, 119, 12))
lower = material("Burnt orange", (235, 79, 9))
mouth = material("Mouth crease", (112, 38, 11))
ink = material("Ink", (30, 24, 21))
cream = material("Eye glint", (255, 246, 216))

body = pebble("Broad, slightly lopsided body", (0, 0.18, 0.62), (0.82, 1.08, 0.62), gold)
for vertex in body.data.vertices:
    x, y, z = vertex.co
    vertex.co.z = max(-0.53, z) + max(0, y - 0.48) * max(0, z + 0.14) * 0.8
pebble("Crooked tail", (0.07, 0.95, 0.93), (0.42, 0.45, 0.27), gold, (0.58, 0.18, 0.1), 0.15, 1)
neck = pebble("Neck", (-0.03, -0.38, 1.01), (0.53, 0.55, 0.48), gold, rough=0.04)
pebble("Tilted head", (-0.075, -0.54, 1.45), (0.59, 0.59, 0.64), gold, (-0.12, -0.15, 0.06), head=True)
pebble("Broad right wing", (0.66, 0.19, 0.68), (0.23, 0.66, 0.30), wing, (0.20, 0.22, -0.18), 0.13)
pebble("Short left wing", (-0.68, 0.24, 0.65), (0.19, 0.55, 0.26), wing, (0.28, -0.18, 0.16), 0.13)

bill("Mouth shadow", [
    (-1.46, -0.04, 1.12, 0.17, 0.015),
    (-1.32, -0.05, 1.10, 0.37, 0.05),
    (-1.10, -0.05, 1.10, 0.41, 0.07),
    (-0.91, -0.07, 1.11, 0.33, 0.09),
], mouth)
bill("Lower bill", [
    (-1.49, -0.04, 1.065, 0.12, 0.035),
    (-1.35, -0.06, 1.015, 0.33, 0.075),
    (-1.15, -0.06, 1.00, 0.38, 0.105),
    (-0.90, -0.07, 1.06, 0.31, 0.12),
], lower)
bill("Overwide upper bill", [
    (-1.61, -0.02, 1.175, 0.12, 0.045),
    (-1.49, -0.03, 1.18, 0.33, 0.09),
    (-1.29, -0.04, 1.18, 0.435, 0.11),
    (-1.10, -0.07, 1.21, 0.40, 0.17),
    (-0.86, -0.08, 1.25, 0.32, 0.21),
], orange)

pebble("Right eye", (0.326, -0.894, 1.61), (0.185, 0.084, 0.193), ink,
       (0, -0.16, 0.71), 0.038, head=True)
pebble("Right eye glint", (0.368, -0.948, 1.676), (0.045, 0.023, 0.047), cream,
       (0, -0.16, 0.71), 0.045, 1, head=True)
pebble("Left eye", (-0.44, -0.906, 1.57), (0.134, 0.077, 0.157), ink,
       (0, 0.18, -0.58), 0.04, head=True)
pebble("Left eye glint", (-0.432, -0.970, 1.626), (0.035, 0.019, 0.038), cream,
       (0, 0.18, -0.58), 0.06, 1, head=True)

bpy.context.view_layer.update()
export_mesh()

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = "Standard"
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.34

camera = bpy.data.objects.new("Three-quarter view", bpy.data.cameras.new("Orthographic"))
bpy.context.collection.objects.link(camera)
camera.location = (4.0, -6.6, 3.08)
aim(camera, (0, -0.18, 1.04))
camera.data.type = "ORTHO"
camera.data.ortho_scale = 3.23
scene.camera = camera
light("Key", (1.5, -4.2, 6.5), 360, 3)
light("Fill", (-4, -2.5, 2.8), 150, 4)
light("Rim", (-0.5, 3, 5), 240, 3)

scene.render.image_settings.file_format = "WEBP"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.quality = 90
scene.render.filepath = "//../../images/duck-mascot.webp"
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "duck.blend"))
bpy.ops.render.render(write_still=True)
