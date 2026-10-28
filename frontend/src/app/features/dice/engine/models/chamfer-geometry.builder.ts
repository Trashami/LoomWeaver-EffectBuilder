import { Quaternion, Vector3, VertexData } from '@babylonjs/core';
import {
  BuiltBabylonDieGeometry,
  DicePolyhedronType,
  SubMeshRange
} from './dice-model.types';
import { getPolyhedronRawTable } from './polyhedra-tables.model';

const cachedFaceNormals = new Map<DicePolyhedronType, Map<number, Vector3>>();

export function chamferGeom(
  vectors: Vector3[],
  faces: number[][],
  chamfer: number
): { vectors: Vector3[]; faces: number[][] } {
  const chamferVectors: Vector3[] = [];
  const chamferFaces: number[][] = [];
  const cornerFaces: number[][] = new Array(vectors.length).fill(0).map(() => []);

  for (let i = 0; i < faces.length; ++i) {
    const ii = faces[i];
    const fl = ii.length - 1;
    const centerPoint = new Vector3();
    const face: number[] = new Array(fl);

    for (let j = 0; j < fl; ++j) {
      const vv = vectors[ii[j]].clone();
      centerPoint.addInPlace(vv);
      cornerFaces[ii[j]].push((face[j] = chamferVectors.push(vv) - 1));
    }
    centerPoint.scaleInPlace(1 / fl);

    for (let j = 0; j < fl; ++j) {
      const vv = chamferVectors[face[j]];
      vv.subtractInPlace(centerPoint).scaleInPlace(chamfer).addInPlace(centerPoint);
    }
    face.push(ii[fl]);
    chamferFaces.push(face);
  }

  for (let i = 0; i < faces.length - 1; ++i) {
    for (let j = i + 1; j < faces.length; ++j) {
      const pairs: number[][] = [];
      let lastm = -1;
      for (let m = 0; m < faces[i].length - 1; ++m) {
        const n = faces[j].indexOf(faces[i][m]);
        if (n >= 0 && n < faces[j].length - 1) {
          if (lastm >= 0 && m !== lastm + 1) pairs.unshift([i, m], [j, n]);
          else pairs.push([i, m], [j, n]);
          lastm = m;
        }
      }
      if (pairs.length !== 4) continue;
      chamferFaces.push([
        chamferFaces[pairs[0][0]][pairs[0][1]],
        chamferFaces[pairs[1][0]][pairs[1][1]],
        chamferFaces[pairs[3][0]][pairs[3][1]],
        chamferFaces[pairs[2][0]][pairs[2][1]],
        -1
      ]);
    }
  }

  for (let i = 0; i < cornerFaces.length; ++i) {
    const cf = cornerFaces[i];
    const face = [cf[0]];
    let count = cf.length - 1;
    while (count) {
      for (let m = faces.length; m < chamferFaces.length; ++m) {
        let index = chamferFaces[m].indexOf(face[face.length - 1]);
        if (index >= 0 && index < 4) {
          if (--index === -1) index = 3;
          const nextVertex = chamferFaces[m][index];
          if (cf.indexOf(nextVertex) >= 0) {
            face.push(nextVertex);
            break;
          }
        }
      }
      --count;
    }
    face.push(-1);
    chamferFaces.push(face);
  }

  return { vectors: chamferVectors, faces: chamferFaces };
}

export function buildBabylonDieVertexData(
  type: DicePolyhedronType,
  baseRadius = 1.15,
  chamferOverride?: number
): BuiltBabylonDieGeometry {
  const table = getPolyhedronRawTable(type, chamferOverride);
  const radius = baseRadius * table.scaleFactor;
  const unitVectors = table.vertices.map(v => new Vector3(v[0], v[1], v[2]).normalize());
  const cg = chamferGeom(unitVectors, table.faces, table.chamfer);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const subMeshRanges: SubMeshRange[] = [];
  const faceNormalsByValue = new Map<number, Vector3>();

  const scaledVectors = cg.vectors.map(v => v.scale(radius));
  const uvFromAngle = (a: number, tab: number): [number, number] => [
    (Math.cos(a) * (1 + tab * 2) + 1) / 2,
    (Math.sin(a) * (1 + tab * 2) + 1) / 2
  ];

  for (let i = 0; i < cg.faces.length; ++i) {
    const ii = cg.faces[i];
    const fl = ii.length - 1;
    const rawMatIdx = ii[fl];
    const materialIndex = rawMatIdx > 0 ? rawMatIdx : 0;

    const center = new Vector3();
    for (let j = 0; j < fl; ++j) center.addInPlace(scaledVectors[ii[j]]);
    center.scaleInPlace(1 / fl);

    const v0 = scaledVectors[ii[0]];
    const v1 = scaledVectors[ii[1]];
    const v2 = scaledVectors[ii[2]];
    const faceNormal = Vector3.Cross(v1.subtract(v0), v2.subtract(v0)).normalize();
    if (Vector3.Dot(faceNormal, center) < 0) faceNormal.scaleInPlace(-1);

    if (rawMatIdx > 0) {
      faceNormalsByValue.set(rawMatIdx, faceNormal.clone());
    }

    const aa = (Math.PI * 2) / fl;
    const startIdx = indices.length;

    for (let j = 0; j < fl - 2; ++j) {
      const pA = scaledVectors[ii[0]];
      const pB = scaledVectors[ii[j + 1]];
      const pC = scaledVectors[ii[j + 2]];

      const [u0, v0uv] = uvFromAngle(table.af, table.tab);
      const [u1, v1uv] = uvFromAngle(aa * (j + 1) + table.af, table.tab);
      const [u2, v2uv] = uvFromAngle(aa * (j + 2) + table.af, table.tab);

      const baseVert = positions.length / 3;
      positions.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
      normals.push(
        faceNormal.x, faceNormal.y, faceNormal.z,
        faceNormal.x, faceNormal.y, faceNormal.z,
        faceNormal.x, faceNormal.y, faceNormal.z
      );
      uvs.push(u0, v0uv, u1, v1uv, u2, v2uv);

      const triCross = Vector3.Cross(pB.subtract(pA), pC.subtract(pA));
      if (Vector3.Dot(triCross, faceNormal) > 0) {
        indices.push(baseVert, baseVert + 2, baseVert + 1);
      } else {
        indices.push(baseVert, baseVert + 1, baseVert + 2);
      }
    }

    const indexCount = indices.length - startIdx;
    const prev = subMeshRanges[subMeshRanges.length - 1];
    if (prev && prev.materialIndex === materialIndex && prev.indexStart + prev.indexCount === startIdx) {
      prev.indexCount += indexCount;
    } else {
      subMeshRanges.push({ materialIndex, indexStart: startIdx, indexCount });
    }
  }

  if (!cachedFaceNormals.has(type)) {
    cachedFaceNormals.set(type, faceNormalsByValue);
  }

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.indices = indices;

  return { vertexData, subMeshRanges, faceNormalsByValue };
}

export function getRotationForTopValue(
  type: DicePolyhedronType,
  targetValue: number,
  yawRadians = 0,
  targetDirection?: Vector3
): Quaternion {
  if (!cachedFaceNormals.has(type)) {
    buildBabylonDieVertexData(type, 1.0);
  }
  const map = cachedFaceNormals.get(type)!;
  let lookup = targetValue;
  if (type === 'd100') {
    lookup = targetValue === 0 || targetValue === 100 ? 10 : Math.max(1, Math.min(10, Math.round(targetValue / 10)));
  } else if (type === 'd10' && targetValue === 0) {
    lookup = 10;
  }

  const normal = map.get(lookup) ?? map.get(1) ?? new Vector3(0, 1, 0);
  const desiredDir = targetDirection ? targetDirection.normalizeToNew() : new Vector3(0, 1, 0);
  const up = type === 'd4' ? desiredDir.scale(-1) : desiredDir;

  const alignQ = new Quaternion();
  Quaternion.FromUnitVectorsToRef(normal.normalizeToNew(), up, alignQ);
  const yawQ = Quaternion.RotationAxis(desiredDir, yawRadians);
  return yawQ.multiply(alignQ);
}
