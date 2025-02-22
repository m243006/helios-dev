import {
    SphereGeometry,
    PlaneGeometry,
    MeshBasicMaterial,
    Mesh,
    ShaderMaterial,
    Group,
    BackSide,
} from "three";

import { LoadMesh } from "./mesh_loader.js";
import {
    vertex_shader as SolarVertexShader,
    fragment_shader as SolarFragmentShader,
} from "./glsl/solar_shaders.js";
import {
    vertex_shader as LascoVertexShader,
    fragment_shader as LascoFragmentShader,
} from "./glsl/lasco_shaders.js";
import Config from "../../Configuration.js";

/**
 * Creates a flat plane that represents the backside of the sun.
 * This side will have only the energy coming off of the sun rendered on it.
 * @param {Texture} texture Sun image texture
 * @returns {Mesh}
 * @private
 */
async function _GetBackside(texture, scale) {
    // Load the mesh
    let geometry = await LoadMesh("./resources/models/sun_model.gltf");

    // Create the shader, this is where the uniforms that appear
    // in the shader are set.
    let shader = new ShaderMaterial({
        uniforms: {
            tex: { value: texture },
            scale: { value: scale },
            x_offset: { value: 0.0 },
            y_offset: { value: 0.0 },
            backside: { value: true },
            opacity: { value: 1 },
            transparent_threshold: { value: 0.05 },
        },
        vertexShader: SolarVertexShader,
        fragmentShader: SolarFragmentShader,
    });
    // Enable transparency, without this, making pixels transparent will
    // just make them white.
    shader.transparent = true;
    // Set the shader to apply to the backside, by default it only applies
    // to the front side.
    shader.side = BackSide;
    // Construct the mesh and return it.
    const backside = new Mesh(geometry, shader);
    return backside;
}

/**
 * Creates a hemisphere with the given texture applied
 * @param {Texture} texture
 * @param {JP2info} jp2 metadata about this texture for positioning
 */
async function CreateHemisphereWithTexture(texture, jp2info) {
    let scale = _ComputeMeshScale(jp2info);
    // Load the backside of the mesh in parallel
    // Load the model
    let geometry = await LoadMesh("./resources/models/sun_model.gltf");

    // Create the shader, this is where the uniforms that appear
    // in the shader are set.
    let shader = new ShaderMaterial({
        uniforms: {
            tex: { value: texture },
            scale: { value: scale },
            x_offset: { value: 0.0 },
            y_offset: { value: 0.0 },
            backside: { value: false },
            opacity: { value: 1 },
            transparent_threshold: { value: 0.05 },
        },
        vertexShader: SolarVertexShader,
        fragmentShader: SolarFragmentShader,
    });
    // Enable transparency, without this, making pixels transparent will
    // just make them white.
    shader.transparent = true;
    // Construct the 3js mesh
    const sphere = new Mesh(geometry, shader);
    const backside = await _GetBackside(texture, scale);
    // Construct the backside of the mesh
    // Add both sphere and backside models to a group, so all operations
    // to the group apply to everything inside.
    const sphere_group = new Group();
    sphere_group.add(sphere);
    sphere_group.add(await backside);
    sphere_group.scale.set(0.04, 0.04, 0.04);
    // Set the scale, this isn't strictly necessary, but keeps our camera position
    // closer to the origin. Something something about render distance consuming more
    // compute cycles. I don't know if this actually improves performance or not
    sphere_group.helios_type = "sun";

    return sphere_group;
}

/**
 * Creates a hemisphere with the given texture applied
 */
async function CreateHemisphere() {
    let geometry = await LoadMesh("./resources/models/sun_model.gltf");
    let material = new MeshBasicMaterial({ color: 0xff0000 });
    /*
    material.opacity = 0;
    material.transparent = true;
    material.polygonOffset = true;
    material.polygonOffsetUnits = 0xffffffff;
    material.polygonOffsetFactor = 0xffffffff;
    */
    let mesh = new Mesh(geometry, material);
    mesh.scale.set(0.04, 0.04, 0.04);
    return mesh;
}

/**
 * Loads the blender test cube
 */
async function LoadCube() {
    let geometry = await LoadMesh("./resources/models/cube4.gltf");
    let material = new MeshBasicMaterial();
    let mesh = new Mesh(geometry, material);
    return mesh;
}

/**
 * Gets the dimensions of a flat plane according to the jp2info
 * @param {JP2Info} jp2info
 * @returns {Object} Object with width, height fields.
 */
function _getPlaneDimensionsFromJp2Info(jp2info) {
    let x_scale = jp2info.width / jp2info.solar_radius;
    let y_scale = jp2info.height / jp2info.solar_radius;
    let width = x_scale;
    let height = y_scale;
    return {
        width: width,
        height: height,
    };
}

async function CreatePlaneWithTexture(texture, jp2info) {
    let dimensions = _getPlaneDimensionsFromJp2Info(jp2info);
    const geometry = new PlaneGeometry(dimensions.width, dimensions.height);
    let shader = new ShaderMaterial({
        uniforms: {
            tex: { value: texture },
            x_offset: { value: 0.0 },
            y_offset: { value: 0.0 },
            opacity: { value: 1 },
        },
        vertexShader: LascoVertexShader,
        fragmentShader: LascoFragmentShader,
    });
    shader.transparent = true;
    const mesh = new Mesh(geometry, shader);
    // API expects all meshes to be groups, so add this mesh to a single group
    const group = new Group();
    group.add(mesh);
    group.helios_type = "sun";
    return group;
}

async function CreateText(text) {
    console.warn("Text labels not implemented");
}

function CreateMarkerModel(text, color) {
    const geometry = new SphereGeometry(0.5, 32, 16);
    const material = new MeshBasicMaterial({ color: color });
    const sphere = new Mesh(geometry, material);
    sphere.helios_type = "marker";
    return sphere;
}

/*
function CreateMarkerModel(texture, text) {
    // TODO: make this more generic.
    // The 78/46 are the dimensions of the active region marker, this makes the plane that's created
    // the correct size so that the active region image is shown in the correct dimenions (no scaling to fit the mesh).
    // const geometry = new PlaneGeometry( 2, 78/46 * 2 );
    const geometry = new PlaneGeometry( 1, 1);
    const material = new MeshBasicMaterial( {map: texture, side: DoubleSide} );
    material.transparent = true;
    // TODO: Investigate if these can be removed.
    // Since polygon offsets are used to make sure certain images show up on top of others, this is here so that the
    // marker is always in front of everything.
    material.polygonOffset = true;
    material.polygonOffsetUnits = -999 * 1000000;
    const plane = new Mesh( geometry, material );

    CreateText(text).then((text_mesh) => {
        plane.add(text_mesh);
    });
    plane.helios_type = "marker";
    return plane;
}
*/

/**
 * Updates a model's texture on the fly
 * @param {Group} group 3js object group containing the sun models
 * @param {Texture} texture New texture to apply
 * @param {JP2info} jp2info
 */
function UpdateModelTexture(group, texture, jp2info, source) {
    // Iterate through the group and update the texture uniform.
    for (const model of group.children) {
        if (
            model.hasOwnProperty("material") &&
            model.material.hasOwnProperty("uniforms")
        ) {
            model.material.uniforms.tex.value = texture;
            if (Config.plane_sources.indexOf(source) != -1) {
                let dimensions = _getPlaneDimensionsFromJp2Info(jp2info);
                model.geometry.width = dimensions.width;
                model.geometry.height = dimensions.height;
                model.updateMatrix();
            } else {
                model.material.uniforms.scale.value =
                    _ComputeMeshScale(jp2info);
            }
        }
    }
}

/**
 * Computes the scale of the mesh to pass into the fragment shader
 * so that the texture fits in the correct spot on the mesh.
 * @param {JP2info} jp2info
 * @returns {number}
 * @private
 */
function _ComputeMeshScale(jp2info) {
    // Currently assumes the sun is always centered in the image.
    // if it's not, this code will need to be updated to handle those offsets
    let diameter = jp2info.solar_radius * 2;
    let sun_image_ratio = diameter / jp2info.width;
    let target_width_ratio = 0.5;
    // We need the hemisphere on the mesh (which is 50% (0.5) of the width)
    // to be the same as the width of the sun in the texture so that it fits perfectly
    // To achieve this we take the width of the sun relative to the width of the image, and create
    // a multiplier so that the with of the hemisphere matches the width of the sun relative to
    // the width of the mesh.
    return sun_image_ratio / target_width_ratio;
}

/**
 * Sets the opacity on all model groups
 * @param {Group} model Model group returned by CreateHemisphereWithTexture
 */
function UpdateModelOpacity(model, opacity) {
    for (const sub_model of model.children) {
        if (sub_model.material.hasOwnProperty("uniforms")) {
            sub_model.material.uniforms.opacity.value = opacity;
        }
    }
}

function _IsSolarModel(model) {
    return model.helios_type == "sun";
}

function _IsMarkerModel(model) {
    return model.helios_type == "marker";
}

/**
 * Frees a mesh's geometry and material
 */
function _FreeMesh(mesh) {
    mesh.geometry.dispose();
    mesh.material.dispose();
}

/**
 * Frees a model group
 * @private
 */
function _FreeGroup(group) {
    for (const model of group.children) {
        FreeModel(model);
    }
}

/**
 * API for freeing a model created with one of the model builder functions
 * @param {Object} object
 */
function FreeModel(object) {
    if (object.type == "Group") {
        _FreeGroup(object);
    } else if (object.type == "Mesh") {
        _FreeMesh(object);
    }
}

export {
    CreateHemisphereWithTexture,
    CreatePlaneWithTexture,
    CreateMarkerModel,
    CreateHemisphere,
    UpdateModelTexture,
    UpdateModelOpacity,
    FreeModel,
    LoadCube,
};
