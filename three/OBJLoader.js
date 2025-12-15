import {
	BufferGeometry,
	FileLoader,
	Float32BufferAttribute,
	Group,
	LineBasicMaterial,
	LineSegments,
	Loader,
	Material,
	Mesh,
	MeshPhongMaterial,
	Points,
	PointsMaterial,
	Vector3,
	Color,
	InstancedMesh,
	Matrix4
} from './three.module.js';

// o object_name | g group_name
const _object_pattern = /^[og]\s*(.+)?/;
// mtllib file_reference
const _material_library_pattern = /^mtllib /;
// usemtl material_name
const _material_use_pattern = /^usemtl /;
// usemap map_name
const _map_use_pattern = /^usemap /;
const _face_vertex_data_separator_pattern = /\s+/;

const _vA = new Vector3();
const _vB = new Vector3();
const _vC = new Vector3();

const _ab = new Vector3();
const _cb = new Vector3();

const _color = new Color();

function ParserState() {

	const state = {
		objects: [],
		object: {},

		vertices: [],
		normals: [],
		colors: [],
		uvs: [],

		materials: {},
		materialLibraries: [],

		startObject: function ( name, fromDeclaration ) {
			if ( this.object && this.object.fromDeclaration === false ) {
				this.object.name = name;
				this.object.fromDeclaration = ( fromDeclaration !== false );
				return;
			}

			const previousMaterial = ( this.object && typeof this.object.currentMaterial === 'function' ? this.object.currentMaterial() : undefined );

			if ( this.object && typeof this.object._finalize === 'function' ) {
				this.object._finalize( true );
			}

			this.object = {
				name: name || '',
				fromDeclaration: ( fromDeclaration !== false ),

				geometry: {
					vertices: [],
					normals: [],
					colors: [],
					uvs: [],
					hasUVIndices: false
				},
				materials: [],
				smooth: true,

				startMaterial: function ( name, libraries ) {
					const previous = this._finalize( false );
					if ( previous && ( previous.inherited || previous.groupCount <= 0 ) ) {
						this.materials.splice( previous.index, 1 );
					}

					const material = {
						index: this.materials.length,
						name: name || '',
						mtllib: ( Array.isArray( libraries ) && libraries.length > 0 ? libraries[ libraries.length - 1 ] : '' ),
						smooth: ( previous !== undefined ? previous.smooth : this.smooth ),
						groupStart: ( previous !== undefined ? previous.groupEnd : 0 ),
						groupEnd: - 1,
						groupCount: - 1,
						inherited: false,
						clone: function ( index ) {
							const cloned = {
								index: ( typeof index === 'number' ? index : this.index ),
								name: this.name,
								mtllib: this.mtllib,
								smooth: this.smooth,
								groupStart: 0,
								groupEnd: - 1,
								groupCount: -1,
								inherited: false
							};
							cloned.clone = this.clone.bind( cloned );
							return cloned;
						}
					};

					this.materials.push( material );
					return material;
				},

				currentMaterial: function () {
					if ( this.materials.length > 0 ) return this.materials[ this.materials.length - 1 ];
					return undefined;
				},

				_finalize: function ( end ) {
					const lastMultiMaterial = this.currentMaterial();
					if ( lastMultiMaterial && lastMultiMaterial.groupEnd === -1 ) {
						lastMultiMaterial.groupEnd = this.geometry.vertices.length / 3;
						lastMultiMaterial.groupCount = lastMultiMaterial.groupEnd - lastMultiMaterial.groupStart;
						lastMultiMaterial.inherited = false;
					}
					if ( end && this.materials.length > 1 ) {
						for ( let mi = this.materials.length -1; mi >= 0; mi-- ) {
							if ( this.materials[ mi ].groupCount <= 0 ) this.materials.splice(mi,1);
						}
					}
					if ( end && this.materials.length === 0 ) {
						this.materials.push({ name:'', smooth: this.smooth });
					}
					return lastMultiMaterial;
				}
			};

			if ( previousMaterial && previousMaterial.name && typeof previousMaterial.clone === 'function' ) {
				const declared = previousMaterial.clone(0);
				declared.inherited = true;
				this.object.materials.push(declared);
			}

			this.objects.push(this.object);
		},

		finalize: function () {
			if ( this.object && typeof this.object._finalize === 'function' ) {
				this.object._finalize(true);
			}
		},

		parseVertexIndex: function ( value, len ) { return (parseInt(value,10) >=0 ? parseInt(value,10)-1 : parseInt(value,10)+len/3)*3; },
		parseNormalIndex: function ( value, len ) { return (parseInt(value,10) >=0 ? parseInt(value,10)-1 : parseInt(value,10)+len/3)*3; },
		parseUVIndex: function ( value, len ) { return (parseInt(value,10) >=0 ? parseInt(value,10)-1 : parseInt(value,10)+len/2)*2; },

		addVertex: function ( a,b,c ) {
			const src=this.vertices,dst=this.object.geometry.vertices;
			dst.push(src[a+0],src[a+1],src[a+2]);
			dst.push(src[b+0],src[b+1],src[b+2]);
			dst.push(src[c+0],src[c+1],src[c+2]);
		},
		addVertexPoint:function(a){const src=this.vertices,dst=this.object.geometry.vertices;dst.push(src[a+0],src[a+1],src[a+2]);},
		addVertexLine:function(a){const src=this.vertices,dst=this.object.geometry.vertices;dst.push(src[a+0],src[a+1],src[a+2]);},
		addNormal:function(a,b,c){const src=this.normals,dst=this.object.geometry.normals;dst.push(src[a+0],src[a+1],src[a+2]);dst.push(src[b+0],src[b+1],src[b+2]);dst.push(src[c+0],src[c+1],src[c+2]);},
		addFaceNormal:function(a,b,c){const src=this.vertices,dst=this.object.geometry.normals;_vA.fromArray(src,a);_vB.fromArray(src,b);_vC.fromArray(src,c);_cb.subVectors(_vC,_vB);_ab.subVectors(_vA,_vB);_cb.cross(_ab);_cb.normalize();dst.push(_cb.x,_cb.y,_cb.z,dst.push(_cb.x,_cb.y,_cb.z),dst.push(_cb.x,_cb.y,_cb.z));},
		addColor:function(a,b,c){const src=this.colors,dst=this.object.geometry.colors;if(src[a]!==undefined)dst.push(src[a+0],src[a+1],src[a+2]);if(src[b]!==undefined)dst.push(src[b+0],src[b+1],src[b+2]);if(src[c]!==undefined)dst.push(src[c+0],src[c+1],src[c+2]);},
		addUV:function(a,b,c){const src=this.uvs,dst=this.object.geometry.uvs;dst.push(src[a+0],src[a+1],src[b+0],src[b+1],src[c+0],src[c+1]);this.object.geometry.hasUVIndices=true;},
		addDefaultUV:function(){const dst=this.object.geometry.uvs;dst.push(0,0,0,0,0,0);},
		addUVLine:function(a){const src=this.uvs,dst=this.object.geometry.uvs;dst.push(src[a+0],src[a+1]);},
		addFace:function(a,b,c,ua,ub,uc,na,nb,nc){const vLen=this.vertices.length;let ia=this.parseVertexIndex(a,vLen);let ib=this.parseVertexIndex(b,vLen);let ic=this.parseVertexIndex(c,vLen);this.addVertex(ia,ib,ic);this.addColor(ia,ib,ic);if(na!==undefined&&na!==''){const nLen=this.normals.length;ia=this.parseNormalIndex(na,nLen);ib=this.parseNormalIndex(nb,nLen);ic=this.parseNormalIndex(nc,nLen);this.addNormal(ia,ib,ic);}else{this.addFaceNormal(ia,ib,ic);}if(ua!==undefined&&ua!==''){const uvLen=this.uvs.length;ia=this.parseUVIndex(ua,uvLen);ib=this.parseUVIndex(ub,uvLen);ic=this.parseUVIndex(uc,uvLen);this.addUV(ia,ib,ic);this.object.geometry.hasUVIndices=true;}else{this.addDefaultUV();}},

		addPointGeometry:function(vertices){this.object.geometry.type='Points';const vLen=this.vertices.length;for(let vi=0,l=vertices.length;vi<l;vi++){const index=this.parseVertexIndex(vertices[vi],vLen);this.addVertexPoint(index);this.addColor(index);}},
		addLineGeometry:function(vertices,uvs){this.object.geometry.type='Line';const vLen=this.vertices.length,uvLen=this.uvs.length;for(let vi=0,l=vertices.length;vi<l;vi++){this.addVertexLine(this.parseVertexIndex(vertices[vi],vLen));}for(let uvi=0,l=uvs.length;uvi<l;uvi++){this.addUVLine(this.parseUVIndex(uvs[uvi],uvLen));}},

	};

	state.startObject('',false);
	return state;
}

//

class OBJLoader extends Loader {

	constructor(manager){ super(manager); this.materials=null; }

	load(url,onLoad,onProgress,onError){
		const scope=this;
		const loader=new FileLoader(this.manager);
		loader.setPath(this.path);
		loader.setRequestHeader(this.requestHeader);
		loader.setWithCredentials(this.withCredentials);
		loader.load(url,function(text){
			try{ onLoad(scope.parse(text)); }
			catch(e){ if(onError){onError(e);} else{console.error(e);} scope.manager.itemError(url);}
		},onProgress,onError);
	}

	setMaterials(materials){ this.materials=materials; return this; }

	parse(text){

		const state=new ParserState();

		if(text.indexOf('\r\n')!==-1) text=text.replace(/\r\n/g,'\n');
		if(text.indexOf('\\\n')!==-1) text=text.replace(/\\\n/g,'');

		const lines=text.split('\n');
		let result=[];
		for(let i=0,l=lines.length;i<l;i++){
			const line=lines[i].trimStart();
			if(line.length===0) continue;
			const lineFirstChar=line.charAt(0);
			if(lineFirstChar==='#') continue;
			if(lineFirstChar==='v'){const data=line.split(_face_vertex_data_separator_pattern);switch(data[0]){case'v':state.vertices.push(parseFloat(data[1]),parseFloat(data[2]),parseFloat(data[3]));if(data.length>=7){_color.setRGB(parseFloat(data[4]),parseFloat(data[5]),parseFloat(data[6])).convertSRGBToLinear();state.colors.push(_color.r,_color.g,_color.b);}else{state.colors.push(undefined,undefined,undefined);}break;case'vn':state.normals.push(parseFloat(data[1]),parseFloat(data[2]),parseFloat(data[3]));break;case'vt':state.uvs.push(parseFloat(data[1]),parseFloat(data[2]));break;}}else if(lineFirstChar==='f'){const lineData=line.slice(1).trim();const vertexData=lineData.split(_face_vertex_data_separator_pattern);const faceVertices=[];for(let j=0,jl=vertexData.length;j<jl;j++){const vertex=vertexData[j];if(vertex.length>0){const vertexParts=vertex.split('/');faceVertices.push(vertexParts);}}const v1=faceVertices[0];for(let j=1,jl=faceVertices.length-1;j<jl;j++){const v2=faceVertices[j];const v3=faceVertices[j+1];state.addFace(v1[0],v2[0],v3[0],v1[1],v2[1],v3[1],v1[2],v2[2],v3[2]);}}else if(lineFirstChar==='l'){const lineParts=line.substring(1).trim().split(' ');let lineVertices=[];const lineUVs=[];if(line.indexOf('/')===-1){lineVertices=lineParts;}else{for(let li=0,llen=lineParts.length;li<llen;li++){const parts=lineParts[li].split('/');if(parts[0]!=='')lineVertices.push(parts[0]);if(parts[1]!=='')lineUVs.push(parts[1]);}}state.addLineGeometry(lineVertices,lineUVs);}else if(lineFirstChar==='p'){const lineData=line.slice(1).trim();const pointData=lineData.split(' ');state.addPointGeometry(pointData);}else if((result=_object_pattern.exec(line))!==null){const name=(' '+result[0].slice(1).trim()).slice(1);state.startObject(name);}else if(_material_use_pattern.test(line)){state.object.startMaterial(line.substring(7).trim(),state.materialLibraries);}else if(_material_library_pattern.test(line)){state.materialLibraries.push(line.substring(7).trim());}else if(_map_use_pattern.test(line)){console.warn('THREE.OBJLoader: Rendering identifier "usemap" not supported. Textures must be defined in MTL files.');}else if(lineFirstChar==='s'){result=line.split(' ');const value=result.length>1?result[1].trim().toLowerCase():'true';state.object.smooth=(value!=='0'&&value!=='off');const material=state.object.currentMaterial();if(material)material.smooth=state.object.smooth;}else{if(line==='\0')continue;console.warn('THREE.OBJLoader: Unexpected line: "'+line+'"');}}

		state.finalize();

		const container=new Group();
		container.materialLibraries=[].concat(state.materialLibraries);

		const hasPrimitives=!(state.objects.length===1 && state.objects[0].geometry.vertices.length===0);

		if(hasPrimitives===true){

			for(let i=0,l=state.objects.length;i<l;i++){

				const object=state.objects[i];
				const geometry=object.geometry;
				const materials=object.materials;
				const isLine=(geometry.type==='Line');
				const isPoints=(geometry.type==='Points');
				let hasVertexColors=false;

				if(geometry.vertices.length===0) continue;

				const buffergeometry=new BufferGeometry();
				buffergeometry.setAttribute('position',new Float32BufferAttribute(geometry.vertices,3));

				if(geometry.normals.length>0) buffergeometry.setAttribute('normal',new Float32BufferAttribute(geometry.normals,3));
				if(geometry.colors.length>0){ hasVertexColors=true; buffergeometry.setAttribute('color',new Float32BufferAttribute(geometry.colors,3));}
				if(geometry.hasUVIndices===true) buffergeometry.setAttribute('uv',new Float32BufferAttribute(geometry.uvs,2));

				const createdMaterials=[];

				for(let mi=0,miLen=materials.length;mi<miLen;mi++){
					const sourceMaterial=materials[mi];
					const materialHash=sourceMaterial.name+'_'+sourceMaterial.smooth+'_'+hasVertexColors;
					let material=state.materials[materialHash];

					if(this.materials!==null){
						material=this.materials.create(sourceMaterial.name);
						if(isLine && material && !(material instanceof LineBasicMaterial)){
							const materialLine=new LineBasicMaterial();
							Material.prototype.copy.call(materialLine,material);
							materialLine.color.copy(material.color);
							material=materialLine;
						}else if(isPoints && material && !(material instanceof PointsMaterial)){
							const materialPoints=new PointsMaterial({size:10,sizeAttenuation:false});
							Material.prototype.copy.call(materialPoints,material);
							materialPoints.color.copy(material.color);
							materialPoints.map=material.map;
							material=materialPoints;
						}
					}

					if(material===undefined){
						if(isLine) material=new LineBasicMaterial();
						else if(isPoints) material=new PointsMaterial({size:1,sizeAttenuation:false});
						else material=new MeshPhongMaterial();
						material.name=sourceMaterial.name;
						material.flatShading=sourceMaterial.smooth?false:true;
						material.vertexColors=hasVertexColors;
						state.materials[materialHash]=material;
					}

					createdMaterials.push(material);
				}

				// --- InstancedMesh Implementation ---

				let mesh;
				if(createdMaterials.length>1){
					for(let mi=0,miLen=materials.length;mi<miLen;mi++){
						const sourceMaterial=materials[mi];
						buffergeometry.addGroup(sourceMaterial.groupStart,sourceMaterial.groupCount,mi);
					}
					if(isLine){
						mesh=new LineSegments(buffergeometry,createdMaterials);
					}else if(isPoints){
						mesh=new Points(buffergeometry,createdMaterials[0]);
					}else{
						// Create InstancedMesh with 1 instance by default
						mesh=new InstancedMesh(buffergeometry,createdMaterials[0],1);
						mesh.instanceMatrix.setUsage(35048); // DynamicDrawUsage
					}
				}else{
					if(isLine){
						mesh=new LineSegments(buffergeometry,createdMaterials[0]);
					}else if(isPoints){
						mesh=new Points(buffergeometry,createdMaterials[0]);
					}else{
						mesh=new InstancedMesh(buffergeometry,createdMaterials[0],1);
						mesh.instanceMatrix.setUsage(35048);
					}
				}

				mesh.name=object.name;
				container.add(mesh);

}

		} else {

			if ( state.vertices.length > 0 ) {

				const instanceCount = state.vertices.length / 3;

				// Base geometry and material for instancing
				const sphereGeometry = new BufferGeometry();
				sphereGeometry.setAttribute( 'position', new Float32BufferAttribute( [0, 0, 0], 3 ) );
				// Could also use a small built-in geometry like SphereBufferGeometry if you import it

				const material = new MeshPhongMaterial({ color: 0xffffff });

				const instancedMesh = new InstancedMesh( sphereGeometry, material, instanceCount );

				const dummy = new Object3D();

				for ( let i = 0; i < instanceCount; i ++ ) {

					const x = state.vertices[ i * 3 + 0 ];
					const y = state.vertices[ i * 3 + 1 ];
					const z = state.vertices[ i * 3 + 2 ];

					dummy.position.set( x, y, z );
					dummy.updateMatrix();

					instancedMesh.setMatrixAt( i, dummy.matrix );

				}

				if ( state.colors.length > 0 && state.colors[ 0 ] !== undefined ) {

					// Create per-instance colors
					const colorAttribute = new Float32BufferAttribute( state.colors, 3 );
					instancedMesh.instanceColor = colorAttribute;

				}

				container.add( instancedMesh );

			}

		}