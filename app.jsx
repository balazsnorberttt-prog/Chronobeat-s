import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, X, XCircle, CheckCircle, RefreshCw, Coins,
  MessageCircle, AlertTriangle, Trophy, Layers, ChevronRight,
  Settings, Mic, BookOpen, Timer, EyeOff, Rewind, Sparkles,
  ShieldAlert, Zap, Vibrate, Smartphone, Volume2, Headphones, DoorOpen,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import Peer from 'peerjs';
import QRCode from 'qrcode';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import './style.css';
import { SONG_PACKS } from './data';

// ============================================================
//  IGAZI 3D KARAKTEREK (professzionalis, animalt glTF modellek
//  a three.js hivatalos keszletebol - szabadon hasznalhatoak)
// ============================================================
// ============================================================
//  CHRONOBUDDY - sajat, kodbol epitett 12 fos karaktergarda
//  (Fall Guys-osan gombolyded, vicces figurak, sajat animacioval.
//   Nincs kulso modell-fugges, nincs licensz-kerdes: 100% sajat!)
//
//  SAJAT .GLB FIGURAK TOVABBRA IS MENNEK:
//  public/models/1.glb, 2.glb, ... - inditaskor automatikusan bekerulnek.
// ============================================================
const CHARACTERS = [
  { name: 'DJ',        color: '#00eaff', buddy: { skin: '#ffd9b3', shirt: '#00b8d4', pants: '#1a1440', hat: 'headphones', glasses: 'none',   extra: 'none' } },
  { name: 'Rocker',    color: '#ff0055', buddy: { skin: '#ffd9b3', shirt: '#1c1c24', pants: '#33334a', hat: 'mohawk',     glasses: 'shades', extra: 'none', hair: '#ff0055' } },
  { name: 'Díva',      color: '#ffd700', buddy: { skin: '#8a5a3b', shirt: '#ffd700', pants: '#7b2dff', hat: 'afro',       glasses: 'star',   extra: 'none', hair: '#2b1a12' } },
  { name: 'Rapper',    color: '#00ff87', buddy: { skin: '#6f4a2f', shirt: '#0f8a4f', pants: '#101018', hat: 'cap',        glasses: 'none',   extra: 'chain', hair: '#101010' } },
  { name: 'Metálos',   color: '#b385ff', buddy: { skin: '#e8c39e', shirt: '#181820', pants: '#181820', hat: 'longhair',   glasses: 'none',   extra: 'none', hair: '#241a30' } },
  { name: 'Nagyi',     color: '#ff9ad1', buddy: { skin: '#f2c9a0', shirt: '#c46aff', pants: '#4a2a6e', hat: 'bun',        glasses: 'round',  extra: 'bow',  hair: '#d9d9e8' } },
  { name: 'Kocka',     color: '#5da9ff', buddy: { skin: '#ffd9b3', shirt: '#2f6fdd', pants: '#26304a', hat: 'flat',       glasses: 'square', extra: 'bowtie', hair: '#6b4a2a' } },
  { name: 'Punk',      color: '#7dff6a', buddy: { skin: '#e8c39e', shirt: '#243024', pants: '#182018', hat: 'spikes',     glasses: 'none',   extra: 'chain', hair: '#7dff6a' } },
  { name: 'Kingsztár', color: '#fff35d', buddy: { skin: '#f0c9a0', shirt: '#f4f4ff', pants: '#c9a227', hat: 'quiff',      glasses: 'gold',   extra: 'none', hair: '#1a1a22' } },
  { name: 'Rasta',     color: '#ffb020', buddy: { skin: '#7a5236', shirt: '#c8102e', pants: '#0a6a2f', hat: 'dreads',     glasses: 'none',   extra: 'none', hair: '#2b1a12' } },
  { name: 'Robó',      color: '#9be9ff', buddy: { skin: '#b9c6d9', shirt: '#8fa1bd', pants: '#5b6a85', hat: 'antenna',    glasses: 'visor',  extra: 'none' } },
  { name: 'Popsztár',  color: '#ff5dde', buddy: { skin: '#ffd9b3', shirt: '#ff5dde', pants: '#3a1440', hat: 'crown',      glasses: 'none',   extra: 'mic',  hair: '#5a3a1a' } },
];

// Valodi hatarolo doboz szamitasa - csontvazas (skinned) modelleknel is pontos!
// (Ez volt a "csak a laba latszik" bug oka: a sima Box3 a csontvazas
// modelleknel rossz meretet adott, ezert a skala szetcsuszott.)
const computeRealBounds = (root) => {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.traverse((o) => {
    if (o.isSkinnedMesh) {
      o.computeBoundingBox();
      if (o.boundingBox) { tmp.copy(o.boundingBox).applyMatrix4(o.matrixWorld); box.union(tmp); }
    } else if (o.isMesh) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(tmp);
    }
  });
  return box;
};

function CharModel({ url, prefer, mood, dims }) {
  const group = useRef();
  const gltf = useLoader(GLTFLoader, url);

  const cloned = useMemo(() => skeletonClone(gltf.scene), [gltf]);
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);

  // EGYSEGES meretezes: minden karakter pontosan 2 egyseg magas,
  // talppal a talajon. A beepitett figurakhoz bemert (dims) ertekek
  // vannak; a sajat modelleket az ELSO ANIMACIOS KEPKOCKA UTAN
  // merjuk be - igy az is jo, aminek az animacioja atmeretezi/
  // elmozgatja a nyers fajlhoz kepest (ez okozta a kilogast).
  const [autoDims, setAutoDims] = useState(null);
  const d = dims || autoDims;
  const fit = useMemo(() => {
    if (!d) return null;
    const scale = 2.0 / (d.h || 1);
    return {
      scale,
      x: -(d.cx || 0) * scale,
      y: -(d.minY || 0) * scale - 1.0, // talp a -1.0 szinten
      z: -(d.cz || 0) * scale,
    };
  }, [d]);

  // Animacio kivalasztasa: pontos nev VAGY reszleges egyezes
  // (a Quaternius-fele "CharacterArmature|Idle" nevekhez is jo)
  useEffect(() => {
    const clips = gltf.animations || [];
    if (!clips.length) return undefined;
    const names = clips.map((cl) => cl.name);
    const wanted = (prefer || []).map((n) => n.toLowerCase());
    let pick = null;
    for (const w of wanted) {
      pick = names.find((n) => n.toLowerCase() === w)
          || names.find((n) => n.toLowerCase().includes(w));
      if (pick) break;
    }
    if (!pick) pick = names[0];
    const clip = clips.find((cl) => cl.name === pick);
    const action = mixer.clipAction(clip, cloned);
    action.reset();
    action.timeScale = mood === 'win' ? 1.35 : 1;
    action.fadeIn(0.25).play();
    return () => { action.fadeOut(0.2); };
  }, [gltf, mixer, cloned, prefer, mood]);

  // Sajat modell: az ELSO 10 MEGJELENITETT kepkockan at merjuk a
  // TENYLEGESEN kirajzolt figurat (futo animacioval egyutt), es a
  // latvany szerint meretezunk. Ez mar nem tud melle merni.
  const meas = useRef({ frames: 0, box: null, done: false });
  useEffect(() => {
    meas.current = { frames: 0, box: new THREE.Box3(), done: !!dims };
    setAutoDims(null);
  }, [cloned, dims]);

  // Animacio leptetese + elo meres + lassu forgas
  useFrame((_, dt) => {
    mixer.update(dt);
    const M = meas.current;
    if (!M.done) {
      cloned.updateWorldMatrix(true, true);
      cloned.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.update(); });
      const b = computeRealBounds(cloned);
      if (Number.isFinite(b.min.y) && Number.isFinite(b.max.y)) M.box.union(b);
      M.frames += 1;
      if (M.frames >= 10 && !M.box.isEmpty()) {
        M.done = true;
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        M.box.getSize(size);
        M.box.getCenter(center);
        setAutoDims({ h: size.y || 1, minY: M.box.min.y, cx: center.x, cz: center.z });
      }
    }
    if (group.current) group.current.rotation.y += dt * (mood === 'win' ? 0.8 : 0.35);
  });

  if (!fit) {
    // A meres alatt lathatatlanul, de animalva fut a modell
    return (
      <group visible={false}>
        <primitive object={cloned} />
      </group>
    );
  }
  return (
    <group ref={group}>
      <group scale={fit.scale} position={[fit.x, fit.y, fit.z]}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

// Ujjal forgatas lendulettel (drei nelkul, sajat megoldas)
function SpinGroup({ spinRef, children }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.y += spinRef.current.v;
    spinRef.current.v *= 0.93;
  });
  return <group ref={ref}>{children}</group>;
}


// ============================================================
//  BUDDYMODEL - a kodbol epitett figura
//  Magassag pontosan 2 egyseg, talp a -1.0 szinten (mint a glb-knel)
// ============================================================
function BuddyModel({ cfg, mood }) {
  const body = useRef();
  const head = useRef();
  const armL = useRef();
  const armR = useRef();

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const dance = mood === 'win';
    const sp = dance ? 6.4 : 2.1;
    const bob = dance ? 0.085 : 0.03;
    if (body.current) {
      body.current.position.y = Math.sin(t * sp) * bob;
      body.current.rotation.z = Math.sin(t * sp * 0.5) * (dance ? 0.09 : 0.03);
    }
    if (head.current) {
      head.current.rotation.x = dance ? Math.sin(t * sp) * 0.22 : Math.sin(t * sp) * 0.06;
      head.current.rotation.z = Math.sin(t * sp * 0.5) * 0.08;
    }
    if (armL.current && armR.current) {
      if (dance) {
        armL.current.rotation.z = 2.5 + Math.sin(t * sp) * 0.45;
        armR.current.rotation.z = -2.5 - Math.cos(t * sp) * 0.45;
      } else {
        armL.current.rotation.z = 0.28 + Math.sin(t * sp) * 0.12;
        armR.current.rotation.z = -0.28 - Math.sin(t * sp) * 0.12;
      }
    }
  });

  const C = cfg;
  const hair = C.hair || '#3a2a1a';

  return (
    <group ref={body} position={[0, 0, 0]}>
      {/* Labak */}
      <mesh position={[-0.2, -0.74, 0]}>
        <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
        <meshStandardMaterial color={C.pants} roughness={0.7} />
      </mesh>
      <mesh position={[0.2, -0.74, 0]}>
        <capsuleGeometry args={[0.13, 0.34, 6, 12]} />
        <meshStandardMaterial color={C.pants} roughness={0.7} />
      </mesh>
      {/* Cipok */}
      <mesh position={[-0.2, -0.95, 0.06]} scale={[1, 0.55, 1.5]}>
        <sphereGeometry args={[0.14, 14, 12]} />
        <meshStandardMaterial color="#f4f4ff" roughness={0.5} />
      </mesh>
      <mesh position={[0.2, -0.95, 0.06]} scale={[1, 0.55, 1.5]}>
        <sphereGeometry args={[0.14, 14, 12]} />
        <meshStandardMaterial color="#f4f4ff" roughness={0.5} />
      </mesh>
      {/* Torzs */}
      <mesh position={[0, -0.12, 0]}>
        <capsuleGeometry args={[0.4, 0.42, 8, 18]} />
        <meshStandardMaterial color={C.shirt} roughness={0.55} />
      </mesh>
      {/* Poci-folt */}
      <mesh position={[0, -0.16, 0.31]} scale={[0.8, 1, 0.5]}>
        <sphereGeometry args={[0.26, 16, 14]} />
        <meshStandardMaterial color="#ffffff" roughness={0.65} transparent opacity={0.22} />
      </mesh>
      {/* Karok */}
      <group ref={armL} position={[-0.44, 0.12, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.1, 0.3, 6, 12]} />
          <meshStandardMaterial color={C.shirt} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <sphereGeometry args={[0.11, 12, 10]} />
          <meshStandardMaterial color={C.skin} roughness={0.6} />
        </mesh>
      </group>
      <group ref={armR} position={[0.44, 0.12, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.1, 0.3, 6, 12]} />
          <meshStandardMaterial color={C.shirt} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <sphereGeometry args={[0.11, 12, 10]} />
          <meshStandardMaterial color={C.skin} roughness={0.6} />
        </mesh>
        {C.extra === 'mic' && (
          <group position={[0, -0.5, 0.1]}>
            <mesh>
              <cylinderGeometry args={[0.035, 0.045, 0.22, 10]} />
              <meshStandardMaterial color="#22222c" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.16, 0]}>
              <sphereGeometry args={[0.075, 12, 10]} />
              <meshStandardMaterial color="#8a90b8" roughness={0.3} metalness={0.6} />
            </mesh>
          </group>
        )}
      </group>
      {/* Nyaklanc / csokornyakkendo / maslI */}
      {C.extra === 'chain' && (
        <mesh position={[0, 0.16, 0.3]} rotation={[1.25, 0, 0]}>
          <torusGeometry args={[0.2, 0.035, 10, 22]} />
          <meshStandardMaterial color="#ffd700" metalness={0.85} roughness={0.25} />
        </mesh>
      )}
      {C.extra === 'bowtie' && (
        <group position={[0, 0.22, 0.36]}>
          <mesh position={[-0.09, 0, 0]} rotation={[0, 0, 0.5]} scale={[1.4, 0.8, 0.5]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#ff0055" roughness={0.5} />
          </mesh>
          <mesh position={[0.09, 0, 0]} rotation={[0, 0, -0.5]} scale={[1.4, 0.8, 0.5]}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#ff0055" roughness={0.5} />
          </mesh>
        </group>
      )}
      {/* Fej */}
      <group ref={head} position={[0, 0.55, 0]}>
        <mesh>
          <sphereGeometry args={[0.42, 24, 20]} />
          <meshStandardMaterial color={C.skin} roughness={0.6} />
        </mesh>
        {/* Szemek */}
        {C.glasses !== 'visor' && (
          <>
            <mesh position={[-0.14, 0.05, 0.37]}>
              <sphereGeometry args={[0.075, 12, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[0.14, 0.05, 0.37]}>
              <sphereGeometry args={[0.075, 12, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.3} />
            </mesh>
            <mesh position={[-0.14, 0.05, 0.435]}>
              <sphereGeometry args={[0.032, 10, 8]} />
              <meshStandardMaterial color="#101018" roughness={0.3} />
            </mesh>
            <mesh position={[0.14, 0.05, 0.435]}>
              <sphereGeometry args={[0.032, 10, 8]} />
              <meshStandardMaterial color="#101018" roughness={0.3} />
            </mesh>
          </>
        )}
        {/* Mosoly */}
        <mesh position={[0, -0.14, 0.36]} rotation={[0.5, 0, 0]}>
          <torusGeometry args={[0.11, 0.022, 8, 14, Math.PI]} />
          <meshStandardMaterial color="#7a3b2e" roughness={0.6} />
        </mesh>
        {/* Szemuvegek */}
        {C.glasses === 'round' && (
          <group position={[0, 0.05, 0.4]}>
            <mesh position={[-0.14, 0, 0]}><torusGeometry args={[0.09, 0.016, 8, 18]} /><meshStandardMaterial color="#d9a200" metalness={0.6} roughness={0.3} /></mesh>
            <mesh position={[0.14, 0, 0]}><torusGeometry args={[0.09, 0.016, 8, 18]} /><meshStandardMaterial color="#d9a200" metalness={0.6} roughness={0.3} /></mesh>
          </group>
        )}
        {C.glasses === 'square' && (
          <group position={[0, 0.05, 0.4]}>
            <mesh position={[-0.14, 0, 0]}><boxGeometry args={[0.17, 0.13, 0.03]} /><meshStandardMaterial color="#101018" roughness={0.4} /></mesh>
            <mesh position={[0.14, 0, 0]}><boxGeometry args={[0.17, 0.13, 0.03]} /><meshStandardMaterial color="#101018" roughness={0.4} /></mesh>
          </group>
        )}
        {C.glasses === 'shades' && (
          <mesh position={[0, 0.05, 0.4]}><boxGeometry args={[0.42, 0.12, 0.04]} /><meshStandardMaterial color="#0a0a12" roughness={0.2} metalness={0.4} /></mesh>
        )}
        {C.glasses === 'gold' && (
          <mesh position={[0, 0.05, 0.4]}><boxGeometry args={[0.42, 0.12, 0.04]} /><meshStandardMaterial color="#f5b91e" roughness={0.25} metalness={0.8} /></mesh>
        )}
        {C.glasses === 'star' && (
          <group position={[0, 0.06, 0.41]}>
            <mesh position={[-0.14, 0, 0]} rotation={[0, 0, 0.4]}><boxGeometry args={[0.16, 0.16, 0.03]} /><meshStandardMaterial color="#ff5dde" roughness={0.3} /></mesh>
            <mesh position={[0.14, 0, 0]} rotation={[0, 0, 0.4]}><boxGeometry args={[0.16, 0.16, 0.03]} /><meshStandardMaterial color="#00eaff" roughness={0.3} /></mesh>
          </group>
        )}
        {C.glasses === 'visor' && (
          <mesh position={[0, 0.05, 0.36]} rotation={[0.06, 0, 0]}>
            <boxGeometry args={[0.56, 0.16, 0.1]} />
            <meshStandardMaterial color="#00eaff" emissive="#00b8d4" emissiveIntensity={0.8} roughness={0.2} />
          </mesh>
        )}
        {/* Frizurak / fejfedok */}
        {C.hat === 'headphones' && (
          <group>
            <mesh rotation={[0, 0, 0]} position={[0, 0.12, 0]}><torusGeometry args={[0.42, 0.045, 10, 24, Math.PI]} /><meshStandardMaterial color="#101018" roughness={0.4} /></mesh>
            <mesh position={[-0.43, 0.02, 0]}><sphereGeometry args={[0.13, 12, 10]} /><meshStandardMaterial color="#00eaff" emissive="#0090aa" emissiveIntensity={0.5} /></mesh>
            <mesh position={[0.43, 0.02, 0]}><sphereGeometry args={[0.13, 12, 10]} /><meshStandardMaterial color="#00eaff" emissive="#0090aa" emissiveIntensity={0.5} /></mesh>
          </group>
        )}
        {C.hat === 'mohawk' && (
          <group>
            {[-0.18, -0.06, 0.06, 0.18].map((z, i) => (
              <mesh key={i} position={[0, 0.42 - Math.abs(z) * 0.5, z]} rotation={[z * 1.2, 0, 0]}>
                <coneGeometry args={[0.07, 0.3, 8]} />
                <meshStandardMaterial color={hair} roughness={0.5} />
              </mesh>
            ))}
          </group>
        )}
        {C.hat === 'spikes' && (
          <group>
            {[[-0.2, 0.3, 0.12], [0, 0.4, 0], [0.2, 0.3, 0.12], [-0.12, 0.36, -0.14], [0.12, 0.36, -0.14]].map((p, i) => (
              <mesh key={i} position={p} rotation={[p[2] * 1.5, 0, -p[0] * 1.4]}>
                <coneGeometry args={[0.06, 0.24, 8]} />
                <meshStandardMaterial color={hair} roughness={0.5} />
              </mesh>
            ))}
          </group>
        )}
        {C.hat === 'afro' && (
          <mesh position={[0, 0.26, -0.02]}>
            <sphereGeometry args={[0.4, 18, 16]} />
            <meshStandardMaterial color={hair} roughness={0.85} />
          </mesh>
        )}
        {C.hat === 'cap' && (
          <group position={[0, 0.28, 0]} rotation={[0.12, Math.PI, 0]}>
            <mesh><sphereGeometry args={[0.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} /><meshStandardMaterial color="#c8102e" roughness={0.6} /></mesh>
            <mesh position={[0, 0.02, 0.4]} rotation={[-0.15, 0, 0]}><boxGeometry args={[0.34, 0.03, 0.26]} /><meshStandardMaterial color="#c8102e" roughness={0.6} /></mesh>
          </group>
        )}
        {C.hat === 'flat' && (
          <mesh position={[0, 0.33, 0]} scale={[1, 0.4, 1]}>
            <sphereGeometry args={[0.38, 16, 12]} />
            <meshStandardMaterial color={hair} roughness={0.8} />
          </mesh>
        )}
        {C.hat === 'longhair' && (
          <group>
            <mesh position={[0, 0.2, -0.06]} scale={[1.05, 0.8, 1.05]}><sphereGeometry args={[0.42, 18, 14, 0, Math.PI * 2, 0, Math.PI / 1.8]} /><meshStandardMaterial color={hair} roughness={0.8} /></mesh>
            <mesh position={[-0.32, -0.1, -0.12]} rotation={[0, 0, 0.2]}><capsuleGeometry args={[0.09, 0.5, 6, 10]} /><meshStandardMaterial color={hair} roughness={0.8} /></mesh>
            <mesh position={[0.32, -0.1, -0.12]} rotation={[0, 0, -0.2]}><capsuleGeometry args={[0.09, 0.5, 6, 10]} /><meshStandardMaterial color={hair} roughness={0.8} /></mesh>
          </group>
        )}
        {C.hat === 'bun' && (
          <group>
            <mesh position={[0, 0.2, -0.02]} scale={[1.03, 0.7, 1.03]}><sphereGeometry args={[0.42, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={hair} roughness={0.85} /></mesh>
            <mesh position={[0, 0.5, -0.05]}><sphereGeometry args={[0.15, 14, 12]} /><meshStandardMaterial color={hair} roughness={0.85} /></mesh>
          </group>
        )}
        {C.hat === 'quiff' && (
          <mesh position={[0, 0.38, 0.16]} rotation={[0.7, 0, 0]} scale={[1, 0.7, 1.3]}>
            <sphereGeometry args={[0.24, 14, 12]} />
            <meshStandardMaterial color={hair} roughness={0.55} />
          </mesh>
        )}
        {C.hat === 'dreads' && (
          <group>
            <mesh position={[0, 0.22, -0.02]} scale={[1.03, 0.6, 1.03]}><sphereGeometry args={[0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={hair} roughness={0.85} /></mesh>
            {[[-0.3, 0.05, -0.2], [0.3, 0.05, -0.2], [-0.34, 0, 0.08], [0.34, 0, 0.08], [0, 0.1, -0.36]].map((p, i) => (
              <mesh key={i} position={[p[0], p[1] - 0.12, p[2]]} rotation={[p[2] * 0.6, 0, -p[0] * 0.5]}>
                <capsuleGeometry args={[0.05, 0.34, 6, 8]} />
                <meshStandardMaterial color={i % 3 === 0 ? '#c8102e' : i % 3 === 1 ? '#f5b91e' : '#0a6a2f'} roughness={0.7} />
              </mesh>
            ))}
          </group>
        )}
        {C.hat === 'antenna' && (
          <group position={[0, 0.42, 0]}>
            <mesh><cylinderGeometry args={[0.02, 0.02, 0.24, 8]} /><meshStandardMaterial color="#5b6a85" roughness={0.4} /></mesh>
            <mesh position={[0, 0.16, 0]}><sphereGeometry args={[0.06, 10, 8]} /><meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={0.9} /></mesh>
          </group>
        )}
        {C.hat === 'crown' && (
          <group position={[0, 0.4, 0]}>
            <mesh><cylinderGeometry args={[0.24, 0.26, 0.12, 12]} /><meshStandardMaterial color="#f5b91e" metalness={0.8} roughness={0.25} /></mesh>
            {[0, 1, 2, 3, 4].map((i) => {
              const a = (i / 5) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.cos(a) * 0.23, 0.13, Math.sin(a) * 0.23]}>
                  <coneGeometry args={[0.05, 0.14, 6]} />
                  <meshStandardMaterial color="#f5b91e" metalness={0.8} roughness={0.25} />
                </mesh>
              );
            })}
          </group>
        )}
        {C.extra === 'bow' && (
          <group position={[0.26, 0.34, 0.18]} rotation={[0, 0, -0.4]}>
            <mesh position={[-0.05, 0, 0]} scale={[1.3, 0.7, 0.5]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#ff0055" roughness={0.5} /></mesh>
            <mesh position={[0.05, 0, 0]} scale={[1.3, 0.7, 0.5]}><sphereGeometry args={[0.06, 8, 8]} /><meshStandardMaterial color="#ff0055" roughness={0.5} /></mesh>
          </group>
        )}
      </group>
    </group>
  );
}

// Ha egy 3D modell nem toltheto be, 2D korong-avatar jelenik meg,
// es a jatek zavartalanul megy tovabb
class ModelBoundary extends React.Component {
  constructor(props) { super(props); this.state = { broken: false }; }
  static getDerivedStateFromError() { return { broken: true }; }
  componentDidCatch() {}
  render() {
    if (this.state.broken) return this.props.fallback;
    return this.props.children;
  }
}

function CharacterStage({ charIndex, size = 200, mood = 'idle' }) {
  const c = CHARACTERS[charIndex % CHARACTERS.length];
  if (LITE_ACTIVE) {
    return (
      <div className="char-canvas" style={{ width: size, height: size }}>
        <div className="avatar-fallback" style={{ width: size * 0.55, height: size * 0.55, '--pc': c.color }}>
          <Play size={Math.round(size * 0.22)} />
        </div>
      </div>
    );
  }
  const prefer = mood === 'win' ? c.win : c.idle;
  const spinRef = useRef({ v: 0, dragging: false, lastX: 0 });

  const onDown = (e) => {
    spinRef.current.dragging = true;
    spinRef.current.lastX = e.clientX;
  };
  const onMove = (e) => {
    if (!spinRef.current.dragging) return;
    spinRef.current.v = (e.clientX - spinRef.current.lastX) * 0.012;
    spinRef.current.lastX = e.clientX;
  };
  const onUp = () => { spinRef.current.dragging = false; };

  return (
    <div
      className="char-canvas"
      style={{ width: size, height: size }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <ModelBoundary
        key={c.url}
        fallback={(
          <div className="avatar-fallback" style={{ width: size * 0.55, height: size * 0.55, '--pc': c.color }}>
            <Play size={size * 0.22} />
          </div>
        )}
      >
      <Canvas dpr={LITE_ACTIVE ? 1 : [1, 1.5]} camera={{ position: [0, 0.15, 4.6], fov: 40 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 6, 4]} intensity={2.4} />
        <directionalLight position={[-5, 3, -4]} intensity={1.2} color="#7fdcff" />
        <pointLight position={[0, -2, 3]} intensity={0.7} color="#ff4d8a" />
        <Suspense fallback={null}>
          <SpinGroup spinRef={spinRef}>
            {c.buddy
              ? <BuddyModel cfg={c.buddy} mood={mood} />
              : <CharModel url={c.url} prefer={prefer} mood={mood} dims={c.dims} />}
          </SpinGroup>
        </Suspense>
      </Canvas>
      </ModelBoundary>
    </div>
  );
}

const APP_VERSION = 'v21';

// ============================================================
//  HELYI PROFIL + TROFEAK (minden localStorage-ban, szerver nelkul)
// ============================================================
const loadProfile = () => {
  try {
    return {
      m: 0, w: 0, placed: 0, wrong: 0, exact: 0, full: 0, veto: 0,
      decades: {}, ach: {},
      ...(JSON.parse(localStorage.getItem('cb_profile_v1') || '{}')),
    };
  } catch (e) {
    return { m: 0, w: 0, placed: 0, wrong: 0, exact: 0, full: 0, veto: 0, decades: {}, ach: {} };
  }
};
const saveProfile = (p) => { try { localStorage.setItem('cb_profile_v1', JSON.stringify(p)); } catch (e) {} };

const ACHIEVEMENTS = [
  { id: 'first',    name: 'Első vér',        desc: 'Fejezd be az első meccsedet!' },
  { id: 'exact5',   name: 'Évszám-mester',   desc: '5 pontos évszám-tipp összesen.' },
  { id: 'full',     name: 'Full House',      desc: 'Év + előadó + cím egyetlen tippben.' },
  { id: 'flawless', name: 'Hibátlan',        desc: 'Meccs legalább 5 lerakással, 0 hibával.' },
  { id: 'veto5',    name: 'Vétókirály',      desc: '5 sikeres vétó összesen.' },
  { id: 'streak7',  name: 'Heti láng',       desc: '7 napos Napi kihívás-sorozat.' },
  { id: 'revwin',   name: 'Visszafelé is',   desc: 'Győzelem Reverse módban.' },
  { id: 'blindwin', name: 'Vakrepülés',      desc: 'Győzelem Blind módban.' },
  { id: 'cards100', name: 'Százas klub',     desc: '100 helyesen lerakott kártya.' },
  { id: 'bothard',  name: 'Gépverő',         desc: 'Győzd le a Nehéz Chrono-botot!' },
  { id: 'speed8',   name: 'Villámkéz',       desc: '8+ lerakás egy Speed Run alatt.' },
  { id: 'rich10',   name: 'Zsugori',         desc: 'Zárj meccset 10+ zsetonnal.' },
];

// ============================================================
//  NAPI KIHIVAS - determinisztikus napi dalsor (seed a datumbol)
// ============================================================
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};
const dailyPick = (list, count, seedStr) => {
  const rnd = mulberry32(parseInt(seedStr, 10));
  const idx = list.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, count).map((i) => list[i]);
};
const loadDailyStore = () => {
  try { return JSON.parse(localStorage.getItem('cb_daily_v1') || '{}'); } catch (e) { return {}; }
};
const saveDailyStore = (d) => { try { localStorage.setItem('cb_daily_v1', JSON.stringify(d)); } catch (e) {} };

// ============================================================
//  SFX - Web Audio API-val szintetizalt hangok (nincs hangfajl)
// ============================================================
const sfx = {
  ctx: null, master: null, vol: 0.6, muted: false, ducked: false,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.apply();
    } catch (e) {}
  },
  apply() {
    if (!this.master) return;
    const v = this.muted ? 0 : this.vol * (this.ducked ? 0.45 : 1);
    this.master.gain.value = v * 0.5;
  },
  setVol(v) { this.vol = v; this.apply(); try { localStorage.setItem('cb_sfxvol', String(v)); } catch (e) {} },
  setMuted(m) { this.muted = m; this.apply(); try { localStorage.setItem('cb_sfxmute', m ? '1' : '0'); } catch (e) {} },
  setDucked(d) { this.ducked = d; this.apply(); },
  tone(f0, f1, dur, type = 'sine', gain = 1, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  tap() { this.tone(1400, 900, 0.05, 'triangle', 0.5); },
  flip() { this.tone(300, 900, 0.16, 'sine', 0.5); this.tone(1800, 1200, 0.05, 'triangle', 0.4, 0.13); },
  success() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.16, 'triangle', 0.7, i * 0.07)); },
  fail() { this.tone(360, 130, 0.4, 'sawtooth', 0.4); },
  coin() { this.tone(1700, 2300, 0.09, 'square', 0.32); this.tone(2300, 2300, 0.12, 'sine', 0.3, 0.08); },
  gold() { [880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, f * 1.01, 0.22, 'sine', 0.55, i * 0.05)); },
  veto() { this.tone(880, 880, 0.12, 'square', 0.45); this.tone(660, 660, 0.12, 'square', 0.45, 0.14); },
  tick(panic) { this.tone(panic ? 1600 : 1100, panic ? 1600 : 1100, 0.04, 'square', panic ? 0.4 : 0.22); },
};

// Haptika: rezgesmintak (ahol nincs tamogatas, csendben kimarad)
const haptics = {
  on: true,
  buzz(p) { if (!this.on) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} },
  tap() { this.buzz(10); },
  success() { this.buzz([30, 40, 60]); },
  fail() { this.buzz([80, 50, 80]); },
  gold() { this.buzz([20, 30, 20, 30, 120]); },
  veto() { this.buzz([60, 60, 60]); },
};
try {
  sfx.vol = Math.min(1, Math.max(0, parseFloat(localStorage.getItem('cb_sfxvol') || '0.6')));
  sfx.muted = localStorage.getItem('cb_sfxmute') === '1';
  haptics.on = localStorage.getItem('cb_haptics') !== '0';
} catch (e) {}

// ============================================================
//  JATEKSZABALY-KONSTANSOK
// ============================================================
const WIN_CARDS = 10;
const YEAR_TOLERANCE = 2;
const SWAP_COST = 2;
const MAX_PLAYERS = 8;

// ============================================================
//  SEGEDFUGGVENYEK
// ============================================================
// ---------- Okos nev/cim-egyeztetes ----------
// Normalizalas: kisbetu, ekezet le, irasjelek ki, nevelok le, & -> and
const stripAccents = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cutParen = (t) => String(t)
  .replace(/\(.*?\)|\[.*?\]/g, ' ')                 // (feat. ...), [Remastered]
  .replace(/\s*-\s*(remaster(ed)?|live|radio edit|single version).*$/i, ' ');
const normText = (t) => stripAccents(String(t || '').toLowerCase())
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\b(the|a|an|az|egy)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const levDist = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};
const isCloseEnough = (guess, target) => {
  if (!guess || !target) return false;
  const g = normText(guess);
  if (!g) return false;
  const candidates = [normText(target), normText(cutParen(target))];
  for (const t of candidates) {
    if (!t) continue;
    if (g === t) return true;
    if (levDist(g, t) <= Math.max(1, Math.ceil(t.length * 0.2))) return true;
  }
  return false;
};

const yearScore = (guess, actual) => {
  const g = parseInt(String(guess).trim(), 10);
  if (Number.isNaN(g)) return 0;
  const d = Math.abs(g - actual);
  if (d === 0) return 2;
  if (d <= YEAR_TOLERANCE) return 1;
  return 0;
};

// Lezart (cross-origin isolated) elonezetben fut-e a jatek? (pl. StackBlitz)
// Ott a JSONP-szkriptek tiltva vannak, ezert CORS-fetch-csel probalkozunk.
// ELES/NORMAL kornyezetben viszont PONTOSAN az eredeti prototipus fut.
const IS_ISOLATED = typeof window !== 'undefined' && window.crossOriginIsolated === true;

// A TE EREDETI, BEVALT MEGOLDASOD - valtoztatas nelkul!
const fetchDeezerUrl = (artist, title) => {
  if (IS_ISOLATED) {
    const q = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
    return fetch(`https://api.deezer.com/search?q=${q}&output=json`)
      .then((r) => r.json())
      .then((d) => (d && d.data && d.data.length > 0 ? d.data[0].preview : null))
      .catch(() => null);
  }
  return new Promise((resolve) => {
    const callbackName = 'dz_cb_' + Math.round(100000 * Math.random());
    const timeout = setTimeout(() => {
      if (window[callbackName]) { window[callbackName] = () => {}; resolve(null); }
    }, 3000);
    window[callbackName] = (data) => {
      clearTimeout(timeout);
      const sc = document.getElementById(callbackName);
      if (sc) sc.remove();
      delete window[callbackName];
      if (data && data.data && data.data.length > 0) { resolve(data.data[0].preview); }
      else { resolve(null); }
    };
    const script = document.createElement('script');
    script.id = callbackName;
    const q = encodeURIComponent(`artist:"${artist}" track:"${title}"`);
    script.src = `https://api.deezer.com/search?q=${q}&output=jsonp&callback=${callbackName}`;
    script.onerror = () => resolve(null);
    document.body.appendChild(script);
  });
};

const shuffleDeck = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Lite mod: gyenge keszulekeken minimalis effekt-terheles
let LITE_ACTIVE = false;
const REDUCED_MOTION = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fxScale = () => (LITE_ACTIVE || REDUCED_MOTION ? 0.2 : 1);
const boom = (opts) => confetti({
  ...opts,
  particleCount: Math.max(6, Math.round((opts.particleCount || 50) * fxScale())),
});

const fireConfetti = (power = 1) => {
  boom({
    particleCount: 70 * power,
    spread: 95,
    origin: { y: 0.55 },
    colors: ['#ffd700', '#00eaff', '#ff0055', '#ffffff', '#7b2dff'],
  });
};

// ============================================================
//  HATTER: ZENEI SZINPAD (diszkogomb, bakelitek, hangjegyek)
// ============================================================
const Backdrop = React.memo(function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="sky" />
      <div className="stars" />
      <div className="beam b1" />
      <div className="beam b2" />
      <div className="discoball">
        <div className="db-string" />
        <div className="db-sphere" />
        <div className="db-glow" />
      </div>
      <div className="float-vinyl v1"><span /></div>
      <div className="float-vinyl v2"><span /></div>
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />
      <div className="note n1">♪</div>
      <div className="note n2">♫</div>
      <div className="note n3">♩</div>
      <div className="horizon" />
      <div className="grid-floor" />
    </div>
  );
});

// ============================================================
//  POSZTAMENS az elo 3D karakterrel
// ============================================================
function Pedestal({ charIndex, size = 170, spotlight = true, mood = 'idle' }) {
  return (
    <div className="pedestal" style={{ '--ped-size': `${size}px` }}>
      {spotlight && <div className="spot-cone" />}
      <div className="ped-canvas-holder">
        <CharacterStage charIndex={charIndex} size={size} mood={mood} />
      </div>
      <div className="ped-ring" />
      <div className="ped-top" />
      <div className="ped-body" />
    </div>
  );
}

// ============================================================
//  EQUALIZER
// ============================================================
function Equalizer({ active }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const el = ref.current;
    if (!el) return undefined;
    const bars = Array.from(el.children);
    const loop = (t) => {
      bars.forEach((b, i) => {
        const v = active
          ? 0.18 + 0.82 * Math.abs(Math.sin(t / 260 + i * 0.85)) * (0.5 + 0.5 * Math.abs(Math.sin(t / 91 + i * 1.7)))
          : 0.08;
        b.style.transform = `scaleY(${v.toFixed(3)})`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return (
    <div className="equalizer" ref={ref}>
      {Array.from({ length: 14 }).map((_, i) => <span key={i} />)}
    </div>
  );
}

// ============================================================
//  BAKELIT LEMEZJATSZO
// ============================================================
function Turntable({ isPlaying, isLoading, onToggle }) {
  return (
    <div className={`turntable ${isPlaying ? 'spinning' : ''}`}>
      <div className="tt-base" />
      <div className="platter">
        <div className="vinyl">
          <div className="vinyl-sheen" />
          <button className="vinyl-label" onClick={onToggle} aria-label="Zene lejatszasa">
            {isLoading
              ? <span className="spinner" />
              : isPlaying
                ? <Pause size={32} fill="#181818" color="#181818" />
                : <Play size={32} fill="#181818" color="#181818" style={{ marginLeft: 3 }} />}
          </button>
        </div>
      </div>
      <div className="tonearm">
        <div className="ta-pivot" />
        <div className="ta-arm" />
        <div className="ta-head" />
      </div>
    </div>
  );
}

// ============================================================
//  3D REJTELYKARTYA
// ============================================================
function MysteryCard({ flipped, card }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty('--rx', `${(-y * 14).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(x * 100 + 50).toFixed(1)}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  };
  return (
    <div className="card-tilt-zone" onPointerMove={onMove} onPointerLeave={onLeave}>
      <div ref={ref} className={`card3d ${flipped ? 'is-flipped' : ''}`}>
        <div className="face front">
          <div className="holo" />
          <div className="front-badge">REJTÉLYDAL</div>
          <div className="front-q">?</div>
          <div className="front-sub">Hallgasd meg, aztán tedd<br />az idővonalad helyes pontjára!</div>
        </div>
        <div className="face back">
          <div className="year-big">{card ? card.y : ''}</div>
          <div className="song-t">{card ? card.t : ''}</div>
          <div className="song-a">{card ? card.a : ''}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  FO KOMPONENS
// ============================================================
export default function App() {
  const [status, setStatus] = useState('menu');
  const [players, setPlayers] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [cardsLeft, setCardsLeft] = useState(0);
  const [currentCard, setCurrentCard] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [wrongIndex, setWrongIndex] = useState(null);
  const [shake, setShake] = useState(false);
  const [tripleMiss, setTripleMiss] = useState(false); // 3 hiba egymas utan
  const missStreakRef = useRef(0);
  const [endReason, setEndReason] = useState('win');

  const [showBetModal, setShowBetModal] = useState(false);
  const [betData, setBetData] = useState({ year: '', artist: '', title: '' });
  const [betResult, setBetResult] = useState(null);

  const [newName, setNewName] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [selectedPack, setSelectedPack] = useState('mix');
  const [showPackSelection, setShowPackSelection] = useState(false);
  const [toast, setToast] = useState(null);

  // ---------- Jatekmodok es extra funkciok ----------
  const [modes, setModes] = useState(() => {
    try { return { blind: false, speed: false, gold: false, reverse: false, veto: false, pranks: false, ...(JSON.parse(localStorage.getItem('cb_modes') || '{}')) }; }
    catch (e) { return { blind: false, speed: false, gold: false, reverse: false, veto: false, pranks: false }; }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [sfxVolUi, setSfxVolUi] = useState(Math.round(sfx.vol * 100));
  const [sfxMuteUi, setSfxMuteUi] = useState(sfx.muted);
  const [hapticsUi, setHapticsUi] = useState(haptics.on);

  // ---------- ONLINE SZOBA (PeerJS - szerver nelkuli WebRTC) ----------
  const [netRole, setNetRole] = useState(null);        // null | 'host' | 'client'
  const [roomCode, setRoomCode] = useState('');
  const [showRoom, setShowRoom] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinName, setJoinName] = useState('');
  const [netBusy, setNetBusy] = useState(false);
  const [snap, setSnap] = useState(null);              // kliens: jatekallapot-pillanatkep
  const [myPeerId, setMyPeerId] = useState(null);
  const [clientBet, setClientBet] = useState(null);    // kliens tipp-ablak
  const [audioMode, setAudioMode] = useState(() => {
    try { return localStorage.getItem('cb_audiomode') || 'own'; } catch (e) { return 'own'; }
  }); // 'own' = sajat telefonon szol | 'speaker' = a hazigazda telefonjan
  const [prankFx, setPrankFx] = useState(null);        // szivatas-effekt a MI kepernyonkon
  const [qrUrl, setQrUrl] = useState(null);             // szoba QR-kod kepe
  const [flight, setFlight] = useState(null);           // repulo kartya animacio
  const [dailyView, setDailyView] = useState('result'); // 'result' | 'calendar'
  const dailyRef = useRef(null);                        // {day, queue, idx, lives, row, exact}
  const botRef = useRef(null);                          // {sigma, label} - Chrono-bot edzomod
  const [showBot, setShowBot] = useState(false);
  const statRef = useRef({ correct: 0, wrong: 0 });     // meccs-szintu szamlalok
  const [swWaiting, setSwWaiting] = useState(null);     // uj app-verzio var aktivalasra
  const [liteSetting, setLiteSetting] = useState(() => {
    try { return localStorage.getItem('cb_lite') || 'auto'; } catch (e) { return 'auto'; }
  }); // 'auto' | 'on' | 'off'
  const [liteActive, setLiteActive] = useState(false);
  const endDoneRef = useRef(false);                     // trofeak egyszeri kiosztasa meccs vegen

  // Trofea kiosztasa (toast + mentes), csak egyszer
  const award = (p, id) => {
    if (p.ach[id]) return;
    p.ach[id] = true;
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) { sfx.gold(); showToast(`🏆 Trófea: ${a.name}!`); }
  };
  const [pendingPlace, setPendingPlace] = useState(null); // veto-ablak: fuggo lerakas
  const [pendingLeft, setPendingLeft] = useState(0);
  const [shame, setShame] = useState(false);            // szegyenfal a MI kepernyonkon
  const [shameProg, setShameProg] = useState(0);
  const shameHoldRef = useRef(null);
  const stageCardRef = useRef(null);   // a rejtelykartya helye (repules kiindulopont)
  const slotRectRef = useRef(null);    // a megkoppintott slot helye (celpont)
  const shameRef = useRef({ idx: -1, timer: null });
  const skipNextRef = useRef({});                       // veto-buntetes: kimarado korok
  const peerRef = useRef(null);
  const connsRef = useRef({});                          // host: peerId -> conn
  const hostConnRef = useRef(null);                     // kliens: kapcsolat a hosthoz
  const actRef = useRef({});                            // friss fuggvenyek a peer-hendlereknek
  const myPeerIdRef = useRef(null);
  const [activeModes, setActiveModes] = useState({ blind: false, speed: false, gold: false, reverse: false, veto: false, pranks: false });
  const [, setCharTick] = useState(0); // ujrarender, ha sajat figurak toltodnek be
  const [tutStep, setTutStep] = useState(-1);      // -1 = nincs tanulokor
  const [timeLeft, setTimeLeft] = useState(null);   // Speed Run visszaszamlalo (mp)
  const [goldCard, setGoldCard] = useState(false);  // Arany Kartya kor?
  const [micOn, setMicOn] = useState(false);
  const turnCountRef = useRef(0);
  const recogRef = useRef(null);
  const revRef = useRef({ ctx: null, src: null, url: null, buf: null });

  const deckRef = useRef([]);
  const discardRef = useRef([]);
  const audioRef = useRef(null);
  const scrollRef = useRef(null);
  const ghostRef = useRef(null);
  const toastTimer = useRef(null);

  // ---------- MEGOSZTHATO EREDMENYKEP (1080x1350 PNG) ----------
  const renderResultCard = async () => {
    // roundRect-fallback regebbi bongeszokhoz
    if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
      // eslint-disable-next-line no-extend-native
      CanvasRenderingContext2D.prototype.roundRect = function rr(x, y, w2, h2, r) {
        const rad = Math.min(r, w2 / 2, h2 / 2);
        this.moveTo(x + rad, y);
        this.arcTo(x + w2, y, x + w2, y + h2, rad);
        this.arcTo(x + w2, y + h2, x, y + h2, rad);
        this.arcTo(x, y + h2, x, y, rad);
        this.arcTo(x, y, x + w2, y, rad);
        this.closePath();
        return this;
      };
    }
    const standings = [...players].sort(
      (a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens
    );
    const winner = standings[0];
    const wChar = CHARACTERS[winner.char % CHARACTERS.length];
    const bigMiss = [...players].sort((a, b) => (b.worstMiss || 0) - (a.worstMiss || 0))[0];
    try { await document.fonts.load('900 90px "Archivo Black"'); } catch (e) {}

    const W = 1080; const H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');

    // Hatter: sotet gradiens + csillagok + synthwave racs
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b0724'); bg.addColorStop(0.65, '#05030f'); bg.addColorStop(1, '#12063a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.15 + Math.random() * 0.5;
      g.fillRect(Math.random() * W, Math.random() * H * 0.7, 2, 2);
    }
    g.globalAlpha = 1;
    const horizon = H * 0.82;
    g.strokeStyle = 'rgba(123,45,255,0.8)'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const y = horizon + i * i * 5 + i * 10;
      if (y > H) break;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    for (let i = -6; i <= 6; i++) {
      g.beginPath(); g.moveTo(W / 2 + i * 90, horizon); g.lineTo(W / 2 + i * 320, H); g.stroke();
    }
    const hg = g.createLinearGradient(0, horizon - 6, 0, horizon + 6);
    hg.addColorStop(0, 'rgba(0,234,255,0)'); hg.addColorStop(0.5, '#00eaff'); hg.addColorStop(1, 'rgba(255,0,85,0)');
    g.fillStyle = hg; g.fillRect(0, horizon - 6, W, 12);

    // Bakelit-motivum a cim mogott
    const dx = W / 2; const dy = 300; const R = 190;
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = '#0a0810';
    g.beginPath(); g.arc(dx, dy, R, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#00eaff'; g.lineWidth = 10;
    g.shadowColor = '#00eaff'; g.shadowBlur = 30;
    g.beginPath(); g.arc(dx, dy, R, 0, Math.PI * 2); g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(120,110,160,0.5)'; g.lineWidth = 1;
    for (let r = R * 0.5; r < R - 12; r += 9) { g.beginPath(); g.arc(dx, dy, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#f5b91e';
    g.beginPath(); g.arc(dx, dy, R * 0.42, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#785200'; g.lineWidth = 6;
    g.beginPath(); g.arc(dx, dy, R * 0.42, 0, Math.PI * 2); g.stroke();
    g.restore();

    // Wordmark + GYOZTES + nev
    g.textAlign = 'center';
    g.fillStyle = '#ffffff';
    g.font = '900 92px "Archivo Black", "Arial Black", sans-serif';
    g.shadowColor = 'rgba(0,234,255,0.8)'; g.shadowBlur = 26;
    g.fillText('CHRONOBEATS', W / 2, 150);
    g.shadowBlur = 0;
    g.fillStyle = '#b9c0e3';
    g.font = '800 34px Montserrat, sans-serif';
    g.fillText('G Y Ő Z T E S', W / 2, 560);
    g.fillStyle = '#ffffff';
    g.font = '900 84px "Archivo Black", "Arial Black", sans-serif';
    g.shadowColor = wChar.color; g.shadowBlur = 36;
    g.fillText(winner.name.toUpperCase(), W / 2, 655);
    g.shadowBlur = 0;

    // Dobogo / vegeredmeny-lista
    g.textAlign = 'left';
    const listY = 740; const rowH = 86;
    standings.slice(0, 5).forEach((p, i) => {
      const y = listY + i * rowH;
      const c = CHARACTERS[p.char % CHARACTERS.length];
      g.fillStyle = i === 0 ? 'rgba(255,215,0,0.10)' : 'rgba(255,255,255,0.05)';
      g.strokeStyle = i === 0 ? 'rgba(255,215,0,0.6)' : 'rgba(255,255,255,0.12)';
      g.lineWidth = 2;
      const rx = 90; const rw = W - 180;
      g.beginPath(); g.roundRect(rx, y, rw, rowH - 16, 20); g.fill(); g.stroke();
      g.fillStyle = c.color;
      g.beginPath(); g.arc(rx + 44, y + (rowH - 16) / 2, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#05030f';
      g.font = '900 24px Montserrat, sans-serif';
      g.textAlign = 'center';
      g.fillText(String(i + 1), rx + 44, y + (rowH - 16) / 2 + 9);
      g.textAlign = 'left';
      g.fillStyle = '#ffffff';
      g.font = '800 34px Montserrat, sans-serif';
      g.fillText(p.name, rx + 84, y + 46);
      g.textAlign = 'right';
      g.fillStyle = '#b9c0e3';
      g.font = '800 30px Montserrat, sans-serif';
      g.fillText(`${p.timeline.length} kártya · ${p.tokens || 0} zseton`, rx + rw - 26, y + 46);
      g.textAlign = 'left';
    });

    // Legnagyobb mellelöves + datum + modok
    let footY = listY + Math.min(standings.length, 5) * rowH + 30;
    if (bigMiss && (bigMiss.worstMiss || 0) > 0) {
      g.fillStyle = '#ff9db8';
      g.font = '800 30px Montserrat, sans-serif';
      g.textAlign = 'center';
      g.fillText(`Legnagyobb mellélövés: ${bigMiss.name} — ${bigMiss.worstMiss} év!`, W / 2, footY);
      footY += 50;
    }
    const dt = new Date();
    const modeNames = [activeModes.blind && 'BLIND', activeModes.speed && 'SPEED RUN', activeModes.gold && 'ARANY KÁRTYA', activeModes.reverse && 'REVERSE', activeModes.veto && 'VÉTÓ', activeModes.pranks && 'SZÍVATÁS'].filter(Boolean);
    g.fillStyle = '#8a90b8';
    g.font = '700 26px Montserrat, sans-serif';
    g.textAlign = 'center';
    g.fillText(`${dt.getFullYear()}. ${String(dt.getMonth() + 1).padStart(2, '0')}. ${String(dt.getDate()).padStart(2, '0')}.${modeNames.length ? ' · ' + modeNames.join(' · ') : ''}`, W / 2, footY);
    g.fillStyle = '#00eaff';
    g.font = '800 28px Montserrat, sans-serif';
    g.fillText(window.location.host || 'chronobeats', W / 2, H - 44);

    return cv;
  };

  const shareResultCard = async () => {
    try {
      showToast('Eredménykép készítése…');
      const cv = await renderResultCard();
      const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
      if (!blob) throw new Error('blob');
      const file = new File([blob], 'chronobeats-eredmeny.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ChronoBeats eredmény' });
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'chronobeats-eredmeny.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      showToast('Kép letöltve!');
    } catch (e) {
      if (String(e && e.name) !== 'AbortError') showToast('A megosztás nem sikerült. 😕');
    }
  };

  // ---------- MECCS VEGE: profil + trofeak ----------
  useEffect(() => {
    if (status !== 'win' || endDoneRef.current) return;
    endDoneRef.current = true;
    const P = loadProfile();
    P.m += 1;
    award(P, 'first');
    const best = [...players].sort((a, b) => (b.timeline ? b.timeline.length : 0) - (a.timeline ? a.timeline.length : 0))[0];
    const localWin = best && !best.peerId && !best.isBot;
    if (localWin) {
      P.w += 1;
      if (activeModes.reverse) award(P, 'revwin');
      if (activeModes.blind) award(P, 'blindwin');
      if (botRef.current && botRef.current.sigma <= 1.5) award(P, 'bothard');
    }
    if (statRef.current.wrong === 0 && statRef.current.correct >= 5) award(P, 'flawless');
    if (activeModes.speed && statRef.current.correct >= 8) award(P, 'speed8');
    if (players.some((p) => !p.peerId && !p.isBot && (p.tokens || 0) >= 10)) award(P, 'rich10');
    saveProfile(P);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ---------- CHRONO-BOT EDZES ----------
  const startBot = (sigma, label) => {
    if (netRole) { showToast('Bot-edzéshez előbb lépj ki a szobából!'); return; }
    const human = players[0]
      ? { id: players[0].id, name: players[0].name, char: players[0].char }
      : { id: 'me', name: 'Te', char: 0 };
    botRef.current = { sigma, label };
    try { localStorage.setItem('cb_botdiff', label); } catch (e) {}
    setShowBot(false);
    beginMatch([human, { id: 'bot', name: `Chrono-bot (${label})`, char: 0, isBot: true }]);
  };

  // A bot kore: rovid "gondolkodas" utan lerak, normal eloszlasu hibaval
  useEffect(() => {
    if (status !== 'game' || !botRef.current) return undefined;
    const ap = players[turnIndex];
    if (!ap || !ap.isBot || !currentCard || flipped || feedback || pendingPlace) return undefined;
    const t = setTimeout(() => {
      const gauss = () => {
        let u = 0; let v = 0;
        while (!u) u = Math.random();
        while (!v) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      };
      const perceived = currentCard.y + gauss() * botRef.current.sigma;
      const tl = ap.timeline;
      let idx = 0;
      while (idx < tl.length && tl[idx].y < perceived) idx += 1;
      handlePlace(idx);
    }, 1700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, turnIndex, currentCard, flipped, feedback, pendingPlace, players]);

  // ---------- NAPI KIHIVAS ----------
  const startDaily = () => {
    if (netRole) { showToast('Napi kihíváshoz előbb lépj ki a szobából!'); return; }
    const day = todayKey();
    const picked = dailyPick(SONG_PACKS.mix.data, 16, day); // 1 kezdo + 10 feladat + 5 csere-tartalek
    dailyRef.current = { day, queue: picked.slice(1, 11), idx: 0, lives: 3, row: [], exact: false };
    setDeck(picked.slice(11));           // a csere ebbol a tartalekbol huz
    discardRef.current = [];
    setPlayers([{ id: 'daily', name: 'Te', char: 0, tokens: 0, timeline: [picked[0]], worstMiss: 0 }]);
    setTurnIndex(0);
    setActiveModes({ blind: false, speed: false, gold: false, reverse: false, veto: false, pranks: false });
    setGoldCard(false);
    setTimeLeft(null);
    setEndReason('win');
    setFeedback(null); setFlipped(false); setWrongIndex(null); setBetResult(null);
    setCurrentCard(picked[1]);
    setStatus('game');
    showToast(`Napi kihívás — 10 dal, 3 élet. Sok sikert!`);
  };

  const finishDaily = () => {
    const D = dailyRef.current;
    const score = D.row.filter((r) => r !== 'R').length;
    const tokens = (players[0] && players[0].tokens) || 0;
    const store = loadDailyStore();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yKey = `${y.getFullYear()}${String(y.getMonth() + 1).padStart(2, '0')}${String(y.getDate()).padStart(2, '0')}`;
    const prevStreak = store.lastDay === yKey ? (store.streak || 0) : 0;
    store.streak = prevStreak + 1;
    store.lastDay = D.day;
    store.best = Math.max(store.best || 0, score);
    store.history = store.history || {};
    store.history[D.day] = { score, row: D.row.join(''), tokens };
    saveDailyStore(store);
    const P = loadProfile();
    P.m += 1;
    award(P, 'first');
    if (store.streak >= 7) award(P, 'streak7');
    saveProfile(P);
    pauseMusic();
    setDailyView('result');
    setStatus('daily-result');
  };

  const dailyAdvance = () => {
    const D = dailyRef.current;
    if (!D) return;
    D.idx += 1;
    setFeedback(null); setFlipped(false); setWrongIndex(null); setBetResult(null);
    if (D.lives <= 0 || D.idx >= D.queue.length) { finishDaily(); return; }
    setCurrentCard(D.queue[D.idx]);
  };

  const shareDaily = async () => {
    const store = loadDailyStore();
    const D = store.history && store.history[todayKey()];
    if (!D) return;
    const emoji = D.row.split('').map((c) => (c === 'G' ? '🟩' : c === 'Y' ? '🟨' : '🟥')).join('');
    const dt = new Date();
    const txt = `ChronoBeats Napi — ${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}.\n${emoji}\nPont: ${D.score}/10 · Zseton: ${D.tokens} · Sorozat: ${store.streak}🔥\n${window.location.origin}${window.location.pathname}`;
    try {
      if (navigator.share) { await navigator.share({ text: txt }); return; }
    } catch (e) {}
    try { await navigator.clipboard.writeText(txt); showToast('Eredmény a vágólapon!'); } catch (e) {}
  };

  // ---------- Szoba-link + QR-kod ----------
  const roomLink = roomCode
    ? `${window.location.origin}${window.location.pathname}?room=${roomCode}`
    : '';

  useEffect(() => {
    if (!roomCode || netRole !== 'host') { setQrUrl(null); return; }
    QRCode.toDataURL(roomLink, {
      width: 340,
      margin: 1,
      color: { dark: '#0b0724', light: '#ffffff' },
    }).then(setQrUrl).catch(() => setQrUrl(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, netRole]);

  const shareRoomLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ChronoBeats szoba', text: `Csatlakozz a(z) ${roomCode} szobához!`, url: roomLink });
        return;
      }
    } catch (e) { /* megszakitva -> masolas */ }
    try {
      await navigator.clipboard.writeText(roomLink);
      showToast('Link a vágólapon!');
    } catch (e) { showToast(roomLink); }
  };

  // Inditas ?room=KOD linkkel: elore kitoltott csatlakozas
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const rc = (p.get('room') || '').toUpperCase();
      if (rc && rc.length === 4) {
        setJoinCode(rc);
        setShowRoom(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (e) {}
  }, []);

  // ---------- LITE MOD: automatikus felismeres + kezi felulbiralas ----------
  useEffect(() => { LITE_ACTIVE = liteActive; }, [liteActive]);

  useEffect(() => {
    if (liteSetting === 'on') { setLiteActive(true); return undefined; }
    if (liteSetting === 'off') { setLiteActive(false); return undefined; }
    // AUTO: gyors hardver-ellenorzes
    const weakHw = (navigator.deviceMemory && navigator.deviceMemory < 4)
      || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4)
      || REDUCED_MOTION;
    if (weakHw) {
      setLiteActive(true);
      return undefined;
    }
    // AUTO: 3 masodperces FPS-meres a hatterben
    let frames = 0;
    let raf = 0;
    let stopped = false;
    const t0 = performance.now();
    const loop = () => {
      if (stopped) return;
      frames += 1;
      if (performance.now() - t0 < 3000) { raf = requestAnimationFrame(loop); return; }
      const fps = frames / 3;
      if (fps < 45) {
        setLiteActive(true);
        showToast('Lite mód bekapcsolva a folyamatos játékért. (Beállításokban módosítható)');
      } else {
        setLiteActive(false);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liteSetting]);

  const setLite = (v) => {
    setLiteSetting(v);
    try { localStorage.setItem('cb_lite', v); } catch (e) {}
  };

  // ---------- PWA: service worker regisztracio + frissites-figyeles ----------
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const h = window.location.hostname;
    // Fejlesztoi kornyezetben (StackBlitz/localhost) nem regisztralunk
    if (h.includes('webcontainer') || h.includes('stackblitz') || h === 'localhost' || h === '127.0.0.1') return;
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      if (reg.waiting) setSwWaiting(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) setSwWaiting(nw);
        });
      });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded) { reloaded = true; window.location.reload(); }
    });
  }, []);

  const applyUpdate = () => {
    try { if (swWaiting) swWaiting.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
  };

  // ---------- SFX: elesztes az elso koppintasnal + gomb-hangok ----------
  useEffect(() => {
    const onDown = (e) => {
      sfx.init();
      if (e.target && e.target.closest && e.target.closest('button')) {
        sfx.tap();
        haptics.tap();
      }
    };
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  // A dal-preview alatt az effektek halkabbak (ducking)
  useEffect(() => { sfx.setDucked(isPlaying); }, [isPlaying]);

  // ---------- Sajat figurak felderitese (public/models/1.glb, 2.glb, ...) ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = [];
      for (let i = 1; i <= 30; i++) {
        try {
          const r = await fetch(`/models/${i}.glb`, { method: 'HEAD' });
          const ct = (r.headers.get('content-type') || '').toLowerCase();
          // A dev szerver a hianyzo fajlra is 200-at adhat (index.html) -> szurjuk
          if (!r.ok || ct.includes('text/html')) break;
          found.push(i);
        } catch (e) { break; }
      }
      if (cancelled || found.length === 0) return;
      if (!CHARACTERS.some((c) => c.custom)) {
        found.forEach((n, idx) => {
          CHARACTERS.push({
            custom: true,
            name: `Figura ${n}`,
            url: `/models/${n}.glb`,
            idle: ['idle', 'stand', 'breathing'],
            win: ['dance', 'win', 'victory', 'run', 'walk', 'wave'],
            color: CUSTOM_COLORS[idx % CUSTOM_COLORS.length],
          });
        });
        setCharTick((v) => v + 1);
        showToast(`🎭 ${found.length} saját figura betöltve!`);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---------- Audio init ----------
  useEffect(() => {
    const a = new Audio();
    if (IS_ISOLATED) a.crossOrigin = 'anonymous';
    a.setAttribute('playsinline', 'true');
    a.setAttribute('webkit-playsinline', 'true');
    const onEnd = () => setIsPlaying(false);
    a.addEventListener('ended', onEnd);
    audioRef.current = a;
    return () => { a.removeEventListener('ended', onEnd); a.pause(); };
  }, []);

  // ---------- Speed Run visszaszamlalo ----------
  useEffect(() => {
    if (timeLeft === null || (status !== 'game' && status !== 'handoff')) return undefined;
    if (timeLeft <= 0) {
      pauseMusic();
      setEndReason('time');
      setStatus('win');
      return undefined;
    }
    if (timeLeft <= 20) sfx.tick(timeLeft <= 10);
    const t = setTimeout(() => setTimeLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, status]);

  // ---------- Zene betoltese ----------
  useEffect(() => {
    if (currentCard && status === 'game') {
      setIsLoading(true);
      setAudioUrl(null);
      setIsPlaying(false);
      fetchDeezerUrl(currentCard.a, currentCard.t).then((url) => {
        setAudioUrl(url);
        if (url && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
        }
        setIsLoading(false);
      });
    }
  }, [currentCard, status]);

  // ---------- Idovonal gorgetese ----------
  // FONTOS: csak a track scrollLeft-jet allitjuk, SOSEM scrollIntoView-t
  // hasznalunk - az az egesz jatekteret eltolta (ez volt a "balra csuszik" bug).
  useEffect(() => {
    if (status === 'game' && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTo({
        left: (el.scrollWidth - el.clientWidth) / 2,
        top: (el.scrollHeight - el.clientHeight) / 2,
        behavior: 'smooth',
      });
    }
  }, [status, turnIndex]);

  useEffect(() => {
    if (wrongIndex !== null && ghostRef.current && scrollRef.current) {
      const track = scrollRef.current;
      const ghost = ghostRef.current;
      const target = ghost.offsetLeft - track.clientWidth / 2 + ghost.clientWidth / 2;
      const targetY = ghost.offsetTop - track.clientHeight / 2 + ghost.clientHeight / 2;
      track.scrollTo({ left: Math.max(0, target), top: Math.max(0, targetY), behavior: 'smooth' });
    }
  }, [wrongIndex]);

  // ---------- Konfetti-eso a gyoztes kepernyon ----------
  useEffect(() => {
    if (status !== 'win') return undefined;
    fireConfetti(3);
    const iv = setInterval(() => {
      confetti({
        particleCount: 35,
        angle: 60 + Math.random() * 60,
        spread: 70,
        origin: { x: Math.random(), y: -0.05 },
        colors: ['#ffd700', '#00eaff', '#ff0055', '#ffffff'],
      });
    }, 900);
    return () => clearInterval(iv);
  }, [status]);

  // ---------- Segedek ----------
  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };

  const toggleMode = (key) => {
    setModes((m) => {
      const next = { ...m, [key]: !m[key] };
      try { localStorage.setItem('cb_modes', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const stopReverse = () => {
    if (revRef.current.src) {
      try { revRef.current.src.onended = null; revRef.current.src.stop(); } catch (e) {}
      revRef.current.src = null;
    }
  };

  const pauseMusic = () => {
    if (audioRef.current) audioRef.current.pause();
    stopReverse();
    setIsPlaying(false);
  };

  const drawNext = () => {
    if (deckRef.current.length === 0 && discardRef.current.length > 0) {
      deckRef.current = shuffleDeck(discardRef.current);
      discardRef.current = [];
      showToast('♻️ A pakli újrakeverve!');
    }
    const c = deckRef.current.length > 0 ? deckRef.current.pop() : null;
    setCardsLeft(deckRef.current.length);
    return c;
  };

  const finishByDeck = () => {
    pauseMusic();
    setEndReason('deck');
    setStatus('win');
  };

  // ---------- Setup ----------
  const addPlayer = () => {
    const name = newName.trim();
    if (!name) return;
    if (players.length >= MAX_PLAYERS) {
      showToast(`Maximum ${MAX_PLAYERS} játékos fér a színpadra!`);
      return;
    }
    setPlayers([...players, {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name,
      char: charIndex % CHARACTERS.length,
    }]);
    setNewName('');
    setCharIndex((p) => (p + 1) % CHARACTERS.length);
  };

  const removePlayer = (id) => setPlayers(players.filter((p) => p.id !== id));

  const beginMatch = (roster) => {
    dailyRef.current = null;
    botRef.current = roster.some((p) => p.isBot) ? botRef.current : null;
    statRef.current = { correct: 0, wrong: 0 };
    endDoneRef.current = false;
    const pack = SONG_PACKS[selectedPack];
    if (!pack || !pack.data || pack.data.length === 0) {
      showToast('Hiba: a választott csomag üres. Válassz másikat!');
      return;
    }
    if (audioRef.current) {
      audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAGZGF0YQQAAAAAAA==';
      audioRef.current.play().then(() => audioRef.current.pause()).catch(() => {});
    }
    const shuffled = shuffleDeck([...pack.data]);
    const initialized = roster.map((p) => ({
      ...p,
      timeline: [shuffled.pop()],
      tokens: 0,
      worstMiss: 0,
    }));
    const firstCard = shuffled.length > 0 ? shuffled.pop() : null;
    deckRef.current = shuffled;
    discardRef.current = [];
    setCardsLeft(shuffled.length);
    setPlayers(initialized);
    setTurnIndex(0);
    setFlipped(false);
    setFeedback(null);
    setWrongIndex(null);
    setBetResult(null);
    setBetData({ year: '', artist: '', title: '' });
    setEndReason('win');
    setActiveModes({ ...modes }); // a beallitasok ITT rogzulnek a meccsre
    turnCountRef.current = 1;
    setGoldCard(false);
    setTimeLeft(modes.speed ? 120 : null);
    setCurrentCard(firstCard);
    const onlineStart = netRole === 'host' && roster.some((p) => p.peerId);
    setStatus(onlineStart || botRef.current ? 'game' : 'handoff');
    // Tanulokor automatikus inditasa az elso jatszmanal
    try {
      if (localStorage.getItem('cb_tut') !== '1') setTutStep(0);
    } catch (e) {}
  };

  const startGame = () => {
    if (players.length === 0) { showToast('Előbb adj hozzá legalább egy játékost!'); return; }
    beginMatch(players);
  };

  const rematch = () => {
    beginMatch(players.map((p) => ({ id: p.id, name: p.name, char: p.char })));
  };

  const backToSetup = () => {
    pauseMusic();
    setPlayers(players.map((p) => ({ id: p.id, name: p.name, char: p.char })));
    setStatus('setup');
  };

  // ---------- Jatek ----------
  const playReversed = async () => {
    // A dal visszafele (Web Audio API): letoltjuk, megforditjuk a buffert
    const R = revRef.current;
    try {
      if (!R.ctx) R.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (R.ctx.state === 'suspended') await R.ctx.resume();
      if (R.url !== audioUrl) {
        const res = await fetch(audioUrl);
        const raw = await res.arrayBuffer();
        const buf = await R.ctx.decodeAudioData(raw);
        for (let ch = 0; ch < buf.numberOfChannels; ch++) buf.getChannelData(ch).reverse();
        R.buf = buf; R.url = audioUrl;
      }
      const src = R.ctx.createBufferSource();
      src.buffer = R.buf;
      src.connect(R.ctx.destination);
      src.onended = () => { R.src = null; setIsPlaying(false); };
      src.start();
      R.src = src;
      setIsPlaying(true);
    } catch (e) {
      // Ha a CDN nem engedi a letoltest, visszaesunk normal lejatszasra
      showToast('🔁 Reverse itt nem megy – normál lejátszás');
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current || isLoading || !audioUrl) return;
    if (isPlaying) {
      pauseMusic();
    } else if (activeModes.reverse) {
      playReversed();
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => showToast('Koppints még egyszer a lejátszáshoz!'));
    }
  };

  const handleSwap = () => {
    if (flipped || feedback) return;
    const activePlayer = players[turnIndex];
    const isAudioBroken = !audioUrl && !isLoading;
    const cost = isAudioBroken ? 0 : SWAP_COST;
    if (!isAudioBroken && activePlayer.tokens < cost) {
      showToast(`Nincs elég zsetonod! A csere ára: ${cost} 🪙`);
      return;
    }
    if (cost > 0) {
      setPlayers(players.map((p, i) => (i === turnIndex ? { ...p, tokens: p.tokens - cost } : p)));
    }
    pauseMusic();
    if (currentCard) discardRef.current.push(currentCard);
    const c = drawNext();
    if (!c) { finishByDeck(); return; }
    setBetResult(null);
    setCurrentCard(c);
  };

  const checkBet = () => {
    setShowBetModal(false);
    if (!currentCard) return;
    const ys = yearScore(betData.year, currentCard.y);
    let earned = ys;
    if (isCloseEnough(betData.artist, currentCard.a)) earned += 1;
    if (isCloseEnough(betData.title, currentCard.t)) earned += 1;
    if (goldCard) earned *= 2; // Arany Kartya: dupla tippnyeremeny
    if (dailyRef.current && ys === 2) dailyRef.current.exact = true;
    {
      const P = loadProfile();
      const dec = Math.floor(currentCard.y / 10) * 10;
      if (!P.decades[dec]) P.decades[dec] = { a: 0, h: 0 };
      P.decades[dec].a += 1;
      if (ys > 0) P.decades[dec].h += 1;
      if (ys === 2) { P.exact += 1; if (P.exact >= 5) award(P, 'exact5'); }
      if (ys === 2 && isCloseEnough(betData.artist, currentCard.a) && isCloseEnough(betData.title, currentCard.t)) {
        P.full += 1; award(P, 'full');
      }
      saveProfile(P);
    }
    if (earned > 0) {
      sfx.coin();
      fireConfetti(Math.min(earned, 3));
      const prankPlus = activeModes.pranks && ys === 2 ? 1 : 0;
      if (prankPlus) showToast('+1 szívatás-token a pontos évért!');
      setPlayers(players.map((p, i) => (i === turnIndex ? { ...p, tokens: p.tokens + earned, pranks: (p.pranks || 0) + prankPlus } : p)));
      setBetResult({ total: earned, exactYear: ys === 2 });
    } else {
      setBetResult({ total: 0 });
    }
    setBetData({ year: '', artist: '', title: '' });
    setTimeout(() => setBetResult(null), 2600);
  };

  const nextTurn = () => {
    setFlipped(false);
    setFeedback(null);
    setWrongIndex(null);
    setBetResult(null);
    pauseMusic();
    const c = drawNext();
    if (!c) { finishByDeck(); return; }
    setTurnIndex((i) => {
      let ni = (i + 1) % players.length;
      let guard = 0;
      while (players[ni] && skipNextRef.current[players[ni].id] && guard < players.length) {
        delete skipNextRef.current[players[ni].id];
        const nm = players[ni].name;
        setTimeout(() => showToast(`⏭️ ${nm} kimarad — vétó-büntetés!`), 60);
        ni = (ni + 1) % players.length;
        guard += 1;
      }
      return ni;
    });
    turnCountRef.current += 1;
    const gold = activeModes.gold && turnCountRef.current % 3 === 0;
    setGoldCard(gold);
    if (gold) { sfx.gold(); haptics.gold(); showToast('ARANY KÁRTYA! Dupla tippnyeremény + 2 bónuszzseton a helyes lerakásért!'); }
    setCurrentCard(c);
    // Online szobaban nincs "add tovabb a telefont" - azonnal a
    // kovetkezo jatekos telefonja aktivalodik
    const online = netRole === 'host' && players.some((p) => p.peerId);
    setStatus(online || botRef.current ? 'game' : 'handoff');
  };

  const VETO_SECONDS = 5;

  // A tenyleges kiertekeles (a veto-ablak UTAN fut le)
  const resolvePlace = (index) => {
    if (flipped || feedback || !currentCard) return;
    pauseMusic();
    setFlipped(true);
    sfx.flip();

    const tl = players[turnIndex].timeline;
    const y = currentCard.y;
    let valid = true;
    if (index > 0 && tl[index - 1].y > y) valid = false;
    if (index < tl.length && tl[index].y < y) valid = false;

    if (valid) {
      missStreakRef.current = 0;
      setFeedback('correct');
      const AP = players[turnIndex];
      if (AP && !AP.isBot && !AP.peerId) {
        statRef.current.correct += 1;
        const P = loadProfile();
        P.placed += 1;
        if (P.placed >= 100) award(P, 'cards100');
        saveProfile(P);
      }
      // Repulo-kartya animacio: a szinpadi kartyatol a beszurasi pontig
      try {
        const fromEl = stageCardRef.current;
        const to = slotRectRef.current;
        if (fromEl && to) {
          const from = fromEl.getBoundingClientRect();
          setFlight({ from, to, card: currentCard, id: Date.now() });
          setTimeout(() => setFlight(null), 950);
        }
      } catch (e) {}
      sfx.success();
      haptics.success();
      fireConfetti(2);
      boom({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: ['#ffd700', '#00eaff', '#ffffff'] });
      boom({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: ['#ffd700', '#ff0055', '#ffffff'] });
      const goldBonus = goldCard ? 2 : 0;
      if (goldBonus) showToast('✨ Arany Kártya bónusz: +2 🪙');
      const newTL = [...tl];
      newTL.splice(index, 0, currentCard);
      const updated = players.map((p, i) => (i === turnIndex ? { ...p, timeline: newTL, tokens: p.tokens + goldBonus } : p));
      if (dailyRef.current) {
        const D = dailyRef.current;
        D.row.push(D.exact ? 'Y' : 'G');
        D.exact = false;
        setTimeout(() => { setPlayers(updated); dailyAdvance(); }, 1900);
        return;
      }
      setTimeout(() => {
        setPlayers(updated);
        if (newTL.length >= WIN_CARDS) {
          pauseMusic();
          setEndReason('win');
          setStatus('win');
        } else {
          nextTurn();
        }
      }, 1900);
    } else {
      let ci = 0;
      while (ci < tl.length && tl[ci].y < y) ci++;
      let d = 0;
      if (index > 0 && tl[index - 1].y > y) d = Math.max(d, tl[index - 1].y - y);
      if (index < tl.length && tl[index].y < y) d = Math.max(d, y - tl[index].y);
      setPlayers(players.map((p, i) => (i === turnIndex ? { ...p, worstMiss: Math.max(p.worstMiss || 0, d) } : p)));
      setFeedback('wrong');
      {
        const AP = players[turnIndex];
        if (AP && !AP.isBot && !AP.peerId) {
          statRef.current.wrong += 1;
          const P = loadProfile();
          P.wrong += 1;
          saveProfile(P);
        }
      }
      sfx.fail();
      haptics.fail();
      missStreakRef.current += 1;
      if (missStreakRef.current >= 3) {
        missStreakRef.current = 0;
        setTripleMiss(true);
        setTimeout(() => setTripleMiss(false), 2200);
      }
      setShake(true);
      setTimeout(() => setShake(false), 650);
      setWrongIndex(ci);
      discardRef.current.push(currentCard);
      setTimeout(nextTurn, 3000);
    }
  };


  // Lerakas: online tobbfos jatekban elobb VETO-ablak, utana kiertekeles
  function handlePlace(index, ev) {
    if (ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect) {
      slotRectRef.current = ev.currentTarget.getBoundingClientRect();
    }
    if (flipped || feedback || !currentCard || pendingPlace) return;
    if (activeModes.veto && players.length > 1) {
      pauseMusic();
      sfx.veto();
      haptics.veto();
      setPendingPlace({ index });
      setPendingLeft(VETO_SECONDS);
      return;
    }
    resolvePlace(index);
  }

  // ---------- VETO ----------
  function hostVeto(vetoerIdx) {
    if (!activeModes.veto) return;
    if (!pendingPlace || vetoerIdx === turnIndex || vetoerIdx < 0 || !currentCard) return;
    const index = pendingPlace.index;
    setPendingPlace(null);
    const placer = players[turnIndex];
    const vetoer = players[vetoerIdx];
    const tl = placer.timeline;
    const y = currentCard.y;
    let valid = true;
    if (index > 0 && tl[index - 1].y > y) valid = false;
    if (index < tl.length && tl[index].y < y) valid = false;
    resolvePlace(index); // a normal kiertekeles lefut (konfetti VAGY razas)
    if (!valid) {
      skipNextRef.current[placer.id] = true;
      if (!vetoer.peerId && !vetoer.isBot) {
        const P = loadProfile();
        P.veto += 1;
        if (P.veto >= 5) award(P, 'veto5');
        saveProfile(P);
      }
      showToast(`🚫 VÉTÓ TALÁLT! ${placer.name} kimarad egy körből, ${vetoer.name} +1 🪙!`);
      setPlayers((prev) => prev.map((p, i) => (i === vetoerIdx ? { ...p, tokens: (p.tokens || 0) + 1 } : p)));
    } else {
      showToast(`🛡️ A lerakás JÓ volt! ${vetoer.name}: -1 🪙 és irány a SZÉGYENFAL! ${placer.name} +1 🪙!`);
      setPlayers((prev) => prev.map((p, i) => {
        if (i === vetoerIdx) return { ...p, tokens: Math.max(0, (p.tokens || 0) - 1) };
        if (i === turnIndex) return { ...p, tokens: (p.tokens || 0) + 1 };
        return p;
      }));
      triggerShame(vetoerIdx);
    }
  }

  // ---------- SZEGYENFAL ----------
  function triggerShame(idx) {
    const p = players[idx];
    if (!p) return;
    if (shameRef.current.timer) clearTimeout(shameRef.current.timer);
    shameRef.current = {
      idx,
      timer: setTimeout(() => {
        const nm = actRef.current.players[shameRef.current.idx] ? actRef.current.players[shameRef.current.idx].name : '';
        actRef.current.setPlayers((prev) => prev.map((q, i) => (i === shameRef.current.idx ? { ...q, tokens: Math.max(0, (q.tokens || 0) - 1) } : q)));
        actRef.current.showToast(`🙈 ${nm} nem vállalta a szégyent: -1 🪙!`);
        shameRef.current = { idx: -1, timer: null };
      }, 12000),
    };
    if (p.peerId) {
      const c = connsRef.current[p.peerId];
      try { if (c && c.open) c.send({ type: 'shame' }); } catch (e) {}
    } else {
      setShame(true);
    }
  }

  function hostShameDone(idx) {
    if (shameRef.current.idx !== idx) return;
    if (shameRef.current.timer) clearTimeout(shameRef.current.timer);
    const nm = players[idx] ? players[idx].name : '';
    shameRef.current = { idx: -1, timer: null };
    showToast(`😅 ${nm} becsülettel letudta a szégyenkört!`);
  }

  // Veto-ablak visszaszamlalo: ha lejar, jon a normal kiertekeles
  useEffect(() => {
    if (!pendingPlace) return undefined;
    if (pendingLeft <= 0) {
      const i = pendingPlace.index;
      setPendingPlace(null);
      resolvePlace(i);
      return undefined;
    }
    const t = setTimeout(() => setPendingLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPlace, pendingLeft]);

  // ============================================================
  //  ONLINE SZOBA - halozati logika
  // ============================================================
  // Minden rendernel frissitjuk, igy a peer-esemenyek mindig a
  // legfrissebb allapotot es fuggvenyeket erik el (nincs "beragadas")
  actRef.current = { players, turnIndex, status, handlePlace, handleSwap, currentCard, showToast, setPlayers, setBetResult, fireConfetti, goldCard, toggleMusic, firePrank, hostVeto, hostShameDone, activeModes };

  const makeCode = () => {
    const AB = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    let c = '';
    for (let i = 0; i < 4; i++) c += AB[Math.floor(Math.random() * AB.length)];
    return c;
  };

  const netSnapshot = () => ({
    type: 'state',
    status,
    players: players.map((p) => ({ id: p.id, peerId: p.peerId || null, name: p.name, char: p.char, tokens: p.tokens || 0, pranks: p.pranks || 0, timeline: p.timeline || [] })),
    turnIndex,
    cardsLeft,
    flipped,
    feedback,
    wrongIndex,
    timeLeft,
    goldCard,
    activeModes,
    card: currentCard ? (flipped || feedback ? currentCard : { masked: true }) : null,
    audioUrl: audioUrl || null,
    audioLoading: isLoading,
    audioMode,
    playing: isPlaying,
    pending: pendingPlace ? { left: pendingLeft } : null,
  });

  const broadcast = () => {
    Object.values(connsRef.current).forEach((c) => {
      try { if (c.open) c.send(netSnapshot()); } catch (e) {}
    });
  };

  // A host minden fontos valtozasnal automatikusan szetkuldi az allapotot
  useEffect(() => {
    if (netRole === 'host') broadcast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netRole, players, turnIndex, currentCard, flipped, feedback, wrongIndex, status, cardsLeft, timeLeft, goldCard, activeModes, audioUrl, isLoading, audioMode, isPlaying, pendingPlace, pendingLeft]);

  const hostHandleAction = (fromPeer, msg) => {
    const A = actRef.current;
    const idx = A.players.findIndex((p) => p.peerId === fromPeer);
    if (idx === -1) return;
    if (msg.a === 'place') {
      if (idx !== A.turnIndex || A.status !== 'game') return;
      A.handlePlace(msg.index);
    } else if (msg.a === 'swap') {
      if (idx !== A.turnIndex || A.status !== 'game') return;
      A.handleSwap();
    } else if (msg.a === 'veto') {
      A.hostVeto(idx);
    } else if (msg.a === 'shameDone') {
      A.hostShameDone(idx);
    } else if (msg.a === 'music') {
      if (idx !== A.turnIndex || A.status !== 'game') return;
      A.toggleMusic();
    } else if (msg.a === 'prank') {
      if (!A.activeModes || !A.activeModes.pranks) return;
      if (idx === A.turnIndex) return; // sajat magat nem szivatja
      const sender = A.players[idx];
      if (!sender || (sender.pranks || 0) < 1) return;
      const targetIdx = A.turnIndex;
      const target = A.players[targetIdx];
      A.setPlayers(A.players.map((p, i) => (i === idx ? { ...p, pranks: (p.pranks || 0) - 1 } : p)));
      const ev = { type: 'prank', kind: msg.kind === 'heartbeat' ? 'heartbeat' : 'scramble', targetIdx, from: sender.name };
      Object.values(connsRef.current).forEach((c) => { try { if (c.open) c.send(ev); } catch (e) {} });
      A.showToast(`😈 ${sender.name} rászívatta ${target.name}-t!`);
      if (!target.peerId) A.firePrank(ev.kind); // a celpont a hazigazda keszuleken jatszik
    } else if (msg.a === 'bet') {
      if (idx !== A.turnIndex || A.status !== 'game' || !A.currentCard) return;
      const d = msg.data || {};
      const ys = yearScore(d.year, A.currentCard.y);
      let earned = ys;
      if (isCloseEnough(d.artist, A.currentCard.a)) earned += 1;
      if (isCloseEnough(d.title, A.currentCard.t)) earned += 1;
      if (A.goldCard) earned *= 2;
      if (earned > 0) {
        sfx.coin();
        A.fireConfetti(Math.min(earned, 3));
        const prankPlus = A.activeModes && A.activeModes.pranks && ys === 2 ? 1 : 0;
        if (prankPlus) A.showToast('+1 szívatás-token a pontos évért!');
        A.setPlayers(A.players.map((p, i) => (i === idx ? { ...p, tokens: (p.tokens || 0) + earned, pranks: (p.pranks || 0) + prankPlus } : p)));
        A.setBetResult({ total: earned, exactYear: ys === 2 });
      } else {
        A.setBetResult({ total: 0 });
      }
      setTimeout(() => A.setBetResult(null), 2600);
    }
  };

  const createRoom = () => {
    if (netBusy) return;
    setNetBusy(true);
    const code = makeCode();
    const peer = new Peer(`cbeats-${code}`);
    peerRef.current = peer;
    peer.on('open', () => {
      setRoomCode(code);
      setNetRole('host');
      setNetBusy(false);
      showToast(`📡 Szoba kész! Kód: ${code}`);
    });
    peer.on('connection', (conn) => {
      conn.on('data', (msg) => {
        if (msg && msg.type === 'join') {
          const A = actRef.current;
          if (A.status !== 'setup') { try { conn.send({ type: 'reject', why: 'A játék már elindult!' }); } catch (e) {} return; }
          connsRef.current[conn.peer] = conn;
          A.setPlayers((prev) => {
            if (prev.length >= MAX_PLAYERS) { try { conn.send({ type: 'reject', why: 'Megtelt a szoba!' }); } catch (e) {} return prev; }
            if (prev.some((p) => p.peerId === conn.peer)) return prev;
            const name = String(msg.name || 'Játékos').slice(0, 14);
            try { conn.send({ type: 'welcome' }); } catch (e) {}
            A.showToast(`📱 ${name} csatlakozott!`);
            return [...prev, { id: Date.now() + Math.random(), peerId: conn.peer, name, char: prev.length % CHARACTERS.length }];
          });
        } else if (msg && msg.type === 'action') {
          hostHandleAction(conn.peer, msg);
        }
      });
      conn.on('close', () => {
        delete connsRef.current[conn.peer];
        const A = actRef.current;
        if (A.status === 'setup') A.setPlayers((prev) => prev.filter((p) => p.peerId !== conn.peer));
      });
    });
    peer.on('error', (err) => {
      setNetBusy(false);
      if (String(err.type) === 'unavailable-id') { createRoomRetry(); }
      else showToast('📡 Hálózati hiba – próbáld újra!');
    });
  };
  const createRoomRetry = () => { try { peerRef.current && peerRef.current.destroy(); } catch (e) {} setTimeout(createRoom, 200); };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    const name = joinName.trim();
    if (code.length !== 4 || !name) { showToast('Add meg a 4 betűs kódot és a neved!'); return; }
    if (netBusy) return;
    setNetBusy(true);
    // Hang-feloldas: a csatlakozas-koppintas "engedelyt ad" a kesobbi zenere
    if (audioRef.current) {
      audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAGZGF0YQQAAAAAAA==';
      audioRef.current.play().then(() => audioRef.current.pause()).catch(() => {});
    }
    const peer = new Peer();
    peerRef.current = peer;
    peer.on('open', (pid) => {
      setMyPeerId(pid);
      myPeerIdRef.current = pid;
      const conn = peer.connect(`cbeats-${code}`, { reliable: true });
      hostConnRef.current = conn;
      const failT = setTimeout(() => { setNetBusy(false); showToast('Nincs ilyen szoba, vagy nem elérhető. 😕'); }, 8000);
      conn.on('open', () => {
        conn.send({ type: 'join', name });
      });
      conn.on('data', (msg) => {
        if (!msg) return;
        if (msg.type === 'welcome') {
          clearTimeout(failT);
          setNetBusy(false);
          setNetRole('client');
          setRoomCode(code);
          setStatus('client');
        } else if (msg.type === 'reject') {
          clearTimeout(failT);
          setNetBusy(false);
          showToast(msg.why || 'Nem sikerült csatlakozni.');
        } else if (msg.type === 'state') {
          setSnap(msg);
        } else if (msg.type === 'shame') {
          setShame(true);
        } else if (msg.type === 'prank') {
          const st = msg;
          setSnap((prev) => prev); // allapot valtozatlan
          showToast(`😈 ${st.from} bevetett egy szívatást!`);
          setTimeout(() => {
            setSnap((prev) => {
              if (prev && prev.players && prev.players[st.targetIdx] && prev.players[st.targetIdx].peerId === myPeerIdRef.current) firePrank(st.kind);
              return prev;
            });
          }, 0);
        }
      });
      conn.on('close', () => { showToast('📡 A kapcsolat megszakadt.'); setStatus('setup'); setNetRole(null); setSnap(null); });
      conn.on('error', () => { clearTimeout(failT); setNetBusy(false); showToast('Nem sikerült csatlakozni. 😕'); });
    });
    peer.on('error', () => { setNetBusy(false); showToast('Nem sikerült csatlakozni. 😕'); });
  };

  // A soros jatekos telefonjan automatikusan elokeszul a dal
  useEffect(() => {
    if (status !== 'client' || !audioRef.current) return;
    const st = snap;
    const active = st && st.players && st.players[st.turnIndex];
    const mine = !!(st && active && active.peerId === myPeerId && st.status === 'game');
    if (mine && st.audioUrl && st.audioMode !== 'speaker') {
      if (audioRef.current.src !== st.audioUrl) {
        audioRef.current.src = st.audioUrl;
        setIsPlaying(false);
      }
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [snap, status, myPeerId]);

  const clientToggleMusic = () => {
    if (!snap) return;
    if (snap.audioMode === 'speaker') { sendAction('music'); return; } // a hazigazdanal szol
    if (!audioRef.current || !snap.audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => showToast('Koppints még egyszer a lejátszáshoz!'));
    }
  };

  // Szivatas-effekt a SAJAT kepernyon (ha minket szivattak meg)
  function firePrank(kind) {
    setPrankFx({ kind, id: Date.now() });
    if (kind === 'heartbeat' && navigator.vibrate) {
      try { navigator.vibrate([180, 90, 180, 90, 260, 70, 260, 70, 380, 60, 380]); } catch (e) {}
    }
    setTimeout(() => setPrankFx(null), kind === 'scramble' ? 5000 : 4200);
  }

  // Szegyenfal: 5 mp folyamatos nyomvatartas kell
  const shameStart = () => {
    if (shameHoldRef.current) return;
    shameHoldRef.current = setInterval(() => {
      setShameProg((v) => {
        const nv = v + 0.1 / 5;
        if (nv >= 1) {
          clearInterval(shameHoldRef.current);
          shameHoldRef.current = null;
          setShame(false);
          if (netRole === 'client') sendAction('shameDone');
          else {
            const meIdx = actRef.current.players.findIndex((p, i) => !p.peerId && i === shameRef.current.idx);
            hostShameDone(meIdx === -1 ? shameRef.current.idx : meIdx);
          }
          return 0;
        }
        return nv;
      });
    }, 100);
  };
  const shameEnd = () => {
    if (shameHoldRef.current) { clearInterval(shameHoldRef.current); shameHoldRef.current = null; }
    setShameProg(0);
  };

  // Ha lejar a 12 mp, az ablak maganak eltunik (a buntetest a host adja)
  useEffect(() => {
    if (!shame) return undefined;
    const t = setTimeout(() => { setShame(false); setShameProg(0); shameEnd(); }, 12200);
    return () => clearTimeout(t);
  }, [shame]);

  const ShameView = shame && (
    <div className="shame-overlay">
      <motion.div className="shame-box glass" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <span className="sh-title">SZÉGYENFAL</span>
        <span className="sh-sub">Besült a vétód! Tartsd nyomva a gombot 5 másodpercig,<br />különben további 1 zsetont veszítesz!</span>
        <button
          type="button"
          className="shame-btn"
          onPointerDown={shameStart}
          onPointerUp={shameEnd}
          onPointerLeave={shameEnd}
        >
          SZÉGYELLEM MAGAM
          <span className="shame-prog"><span style={{ width: `${Math.round(shameProg * 100)}%` }} /></span>
        </button>
      </motion.div>
    </div>
  );

  const sendAction = (a, extra = {}) => {
    try { if (hostConnRef.current && hostConnRef.current.open) hostConnRef.current.send({ type: 'action', a, ...extra }); } catch (e) {}
  };

  const leaveRoom = () => {
    try { peerRef.current && peerRef.current.destroy(); } catch (e) {}
    peerRef.current = null; connsRef.current = {}; hostConnRef.current = null;
    setNetRole(null); setRoomCode(''); setSnap(null);
    setStatus('setup');
  };

  // ---------- Hangvezerles (Push-to-Talk, Web Speech API) ----------
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const micStart = () => {
    if (!SR || micOn) return;
    try {
      const r = new SR();
      r.lang = 'hu-HU';
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (ev) => {
        const said = (ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : '').trim();
        if (!said) return;
        const ym = said.match(/(19|20)\d{2}/);
        setBetData((d) => {
          const next = { ...d };
          let rest = said;
          if (ym) { next.year = ym[0]; rest = rest.replace(ym[0], '').trim(); }
          if (rest.length > 1) {
            if (!next.artist) next.artist = rest;
            else next.title = rest;
          }
          return next;
        });
        showToast(`🎙️ Értettem: "${said}"`);
      };
      r.onend = () => setMicOn(false);
      r.onerror = () => { setMicOn(false); showToast('🎙️ Nem sikerült – próbáld újra!'); };
      recogRef.current = r;
      r.start();
      setMicOn(true);
    } catch (e) { setMicOn(false); }
  };
  const micStop = () => { try { if (recogRef.current) recogRef.current.stop(); } catch (e) {} };

  // ---------- Tanulokor ----------
  const TUT_STEPS = [
    { icon: '🎧', arrow: '⬆', cls: 'tp-stage',    text: 'Koppints a lemezjátszóra, és hallgasd meg a rejtélydalt!' },
    { icon: '🪙', arrow: '⬇', cls: 'tp-bet',      text: 'Mersz tippelni? Évszám, előadó vagy cím eltalálásáért zseton jár!' },
    { icon: '📅', arrow: '⬇', cls: 'tp-timeline', text: 'Ezután helyezd a dalt az idővonalad helyes pontjára a + gombokkal!' },
    { icon: '🔄', arrow: '⬆', cls: 'tp-swap',     text: 'Nem megy a dal? A CSERE gombbal újat húzhatsz. Sok sikert! 🚀' },
  ];
  const endTutorial = () => {
    setTutStep(-1);
    try { localStorage.setItem('cb_tut', '1'); } catch (e) {}
  };
  const TutorialView = tutStep >= 0 && status === 'game' && (
    <div className="tut-overlay" onClick={() => (tutStep < TUT_STEPS.length - 1 ? setTutStep(tutStep + 1) : endTutorial())}>
      <motion.div
        key={tutStep}
        className={`tut-bubble glass ${TUT_STEPS[tutStep].cls}`}
        initial={{ scale: 0.7, opacity: 0, y: 14 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`tut-arrow ${TUT_STEPS[tutStep].arrow === '⬆' ? 'up' : 'down'}`}>{TUT_STEPS[tutStep].arrow}</div>
        <div className="tut-icon">{TUT_STEPS[tutStep].icon}</div>
        <div className="tut-step">{tutStep + 1} / {TUT_STEPS.length}</div>
        <div className="tut-text">{TUT_STEPS[tutStep].text}</div>
        <div className="tut-actions">
          <button type="button" className="btn-3d ghost small" onClick={endTutorial}>Kihagyom</button>
          <button
            type="button"
            className="btn-3d gold small"
            onClick={() => (tutStep < TUT_STEPS.length - 1 ? setTutStep(tutStep + 1) : endTutorial())}
          >
            {tutStep < TUT_STEPS.length - 1 ? 'Tovább' : 'Játék indul!'}
          </button>
        </div>
      </motion.div>
    </div>
  );

  // ---------- Beallitasok (fogaskerek) ----------
  const MODE_LIST = [
    { key: 'blind',   icon: <EyeOff size={18} />,  name: 'Blind Mode',  desc: 'Az idővonal évszámai rejtve — fejből kell tudnod a sorrendet!' },
    { key: 'speed',   icon: <Timer size={18} />,   name: 'Speed Run',   desc: '2 perces visszaszámlálás — akié a leghosszabb idővonal, nyer!' },
    { key: 'gold',    icon: <Sparkles size={18} />, name: 'Arany Kártya', desc: 'Minden 3. kártya arany: dupla tippnyeremény és +2 bónuszzseton!' },
    { key: 'reverse', icon: <Rewind size={18} />,  name: 'Reverse Mode', desc: 'A dal visszafelé szól — csak az igazi mesterek ismerik fel!' },
    { key: 'veto',    icon: <ShieldAlert size={18} />, name: 'Vétó', desc: 'Online: 5 mp-ig megvétózható a lerakás. Sikeres vétó: a hibázó kimarad. Besült vétó: Szégyenfal!', online: true },
    { key: 'pranks',  icon: <Zap size={18} />, name: 'Szívatások', desc: 'Online: pontos évtippért szívatás-token jár — Rövidzárlat és Frász vethető be a soros játékos ellen!', online: true },
  ];
  const SettingsView = (
    <AnimatePresence>
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="modal-box glass settings-modal"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
          >
            <button type="button" className="close-modal" onClick={() => setShowSettings(false)}><X size={22} /></button>
            <h3 className="modal-title">JÁTÉKMÓDOK</h3>
            <div className="mode-list">
              {MODE_LIST.map((m) => (
                <button key={m.key} type="button" className={`mode-row ${modes[m.key] ? 'on' : ''}`} onClick={() => toggleMode(m.key)}>
                  <span className="mr-icon">{m.icon}</span>
                  <span className="mr-body">
                    <span className="mr-name">{m.name}</span>
                    <span className="mr-desc">{m.desc}</span>
                  </span>
                  <span className={`mr-toggle ${modes[m.key] ? 'on' : ''}`} />
                </button>
              ))}
            </div>
            <div className="settings-note">A módok a meccs INDÍTÁSAKOR rögzülnek — játék közben már nem változnak.</div>

            <h3 className="modal-title small">HANG ÉS REZGÉS</h3>
            <div className="sfx-row">
              <button
                type="button"
                className={`mode-row slim ${sfxMuteUi ? '' : 'on'}`}
                onClick={() => { const m = !sfxMuteUi; setSfxMuteUi(m); sfx.setMuted(m); if (!m) sfx.coin(); }}
              >
                <span className="mr-icon"><Volume2 size={17} /></span>
                <span className="mr-body"><span className="mr-name">Hangeffektek</span></span>
                <span className={`mr-toggle ${sfxMuteUi ? '' : 'on'}`} />
              </button>
              <input
                type="range"
                min="0" max="100"
                value={sfxVolUi}
                className="sfx-slider"
                onChange={(e) => { const v = Number(e.target.value); setSfxVolUi(v); sfx.setVol(v / 100); }}
                onPointerUp={() => sfx.coin()}
              />
              <button
                type="button"
                className={`mode-row slim ${hapticsUi ? 'on' : ''}`}
                onClick={() => {
                  const h = !hapticsUi;
                  setHapticsUi(h);
                  haptics.on = h;
                  try { localStorage.setItem('cb_haptics', h ? '1' : '0'); } catch (e) {}
                  if (h) haptics.success();
                }}
              >
                <span className="mr-icon"><Vibrate size={17} /></span>
                <span className="mr-body"><span className="mr-name">Rezgés (haptika)</span></span>
                <span className={`mr-toggle ${hapticsUi ? 'on' : ''}`} />
              </button>
            </div>
            <h3 className="modal-title small">TELJESÍTMÉNY (LITE MÓD)</h3>
            <div className="lite-row">
              {[['auto', 'Auto'], ['on', 'Be'], ['off', 'Ki']].map(([v, lbl]) => (
                <button
                  key={v}
                  type="button"
                  className={`d-tab ${liteSetting === v ? 'on' : ''}`}
                  onClick={() => setLite(v)}
                >{lbl}</button>
              ))}
            </div>
            <div className="settings-note">
              Lite módban a háttér-animációk és a 3D figurák kikapcsolnak — gyengébb telefonon is folyamatos a játék.
              {liteActive ? ' Jelenleg: BEKAPCSOLVA.' : ' Jelenleg: kikapcsolva.'}
            </div>
            <div className="settings-version">ChronoBeats {APP_VERSION}</div>
            <button
              type="button"
              className="btn-3d ghost handbook-btn"
              onClick={() => {
                setShowSettings(false);
                if (status === 'game') setTutStep(0);
                else showToast('📖 A tanulókör a játékban indul el!');
              }}
            >
              <BookOpen size={17} /> KÉZIKÖNYV (TANULÓKÖR)
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // ---------- Kozos elemek ----------
  const ToastView = (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      {swWaiting && (
        <div className="sw-banner glass">
          <span>Új verzió érhető el!</span>
          <button type="button" className="btn-3d gold small" onClick={applyUpdate}>FRISSÍTÉS</button>
        </div>
      )}
    </>
  );

  // ============================================================
  //  SETUP
  // ============================================================
  // ============================================================
  //  FOMENU (4.5 - veglegesitett latvanyterv)
  // ============================================================
  if (status === 'menu') {
    const mc = CHARACTERS[charIndex % CHARACTERS.length];
    const dstore = loadDailyStore();
    const dtoday = dstore.history && dstore.history[todayKey()];
    const prof = loadProfile();
    const achN = Object.keys(prof.ach).length;
    const modeN = Object.values(modes).filter(Boolean).length;
    let botDiff = '';
    try { botDiff = localStorage.getItem('cb_botdiff') || ''; } catch (e) {}
    return (
      <div className={`app-container menu-screen ${liteActive ? 'lite' : ''}`}>
        {ToastView}
        <div className="menu-scroll">
          {/* 1. Fejlec: csak a fogaskerek (az overline szandekosan kimarad) */}
          <div className="menu-head">
            <span />
            <button type="button" className="gear-ghost" onClick={() => setShowSettings(true)} aria-label="Beállítások">
              <Settings size={20} />
            </button>
          </div>

          {/* 2. Hos-sor: terhatasu wordmark + karakter-szinpad */}
          <div className="hero-row">
            <div className="wordmark bob" style={{ animationDelay: '0.2s' }}>
              <span className="wm-line">CHRONO</span>
              <span className="wm-line">BEATS</span>
            </div>
            <div className="hero-stage bob" style={{ animationDelay: '0.9s' }}>
              <div className="spot-cone" />
              <CharacterStage charIndex={charIndex} size={148} mood="idle" />
              <div className="stage-ring" />
              <div className="stage-arrows">
                <button type="button" className="arrow-ghost" aria-label="Előző figura" onClick={() => setCharIndex((p) => (p - 1 + CHARACTERS.length) % CHARACTERS.length)}>‹</button>
                <button type="button" className="arrow-ghost" aria-label="Következő figura" onClick={() => setCharIndex((p) => (p + 1) % CHARACTERS.length)}>›</button>
              </div>
            </div>
          </div>

          {/* 3. Fo CTA */}
          <button type="button" className="cta-primary bob" style={{ animationDelay: '1.5s' }} onClick={() => setStatus('setup')}>
            <Play size={19} /> JÁTÉK INDÍTÁSA
            <span className="cta-shine" />
          </button>

          {/* 4. Pakli-sor */}
          <button type="button" className="deck-row" onClick={() => setShowPackSelection(true)}>
            Pakli: {SONG_PACKS[selectedPack].label} · {SONG_PACKS[selectedPack].data.length} dal <RefreshCw size={12} />
          </button>

          {/* 5. 2x2 csemperacs */}
          <div className="tile-grid">
            
            <button type="button" className="menu-tile t-bot bob" style={{ animationDelay: '1.1s' }} onClick={() => setShowBot(true)}>
              <span className="tile-ico"><Play size={20} /></span>
              <span className="tile-name">CHRONO-BOT</span>
              <span className="tile-meta">{botDiff ? `${botDiff} fokozat` : 'Három fokozat'}</span>
            </button>
            
            <button type="button" className="menu-tile t-trophy bob" style={{ animationDelay: '0.7s' }} onClick={() => setStatus('stats')}>
              <span className="tile-ico"><Trophy size={20} /></span>
              <span className="tile-name">TRÓFEÁK</span>
              <span className="tile-meta">{achN} / 12 megszerezve</span>
            </button>
          </div>

          {/* 6. Labsor */}
          <button type="button" className="menu-foot" onClick={() => setShowSettings(true)}>
            Extra módok · {modeN} aktív
          </button>
        </div>

        {SettingsView}
        {BotModalView}
        {RoomModalView}
        {PackModalView}
        {TutorialView}
      </div>
    );
  }

  // ============================================================
  //  STATISZTIKA ES TROFEAK
  // ============================================================
  const BotModalView = (
    <AnimatePresence>
          {showBot && (
            <div className="modal-overlay" onClick={() => setShowBot(false)}>
              <motion.div
                onClick={(e) => e.stopPropagation()}
                className="modal-box glass settings-modal"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
              >
                <button type="button" className="close-modal" onClick={() => setShowBot(false)}><X size={22} /></button>
                <h3 className="modal-title">CHRONO-BOT EDZÉS</h3>
                <p className="modal-sub">A bot ugyanazokkal a szabályokkal játszik — csak a füle különbözik. Te kezdesz!</p>
                <div className="mode-list">
                  <button type="button" className="mode-row" onClick={() => startBot(6, 'Könnyű')}>
                    <span className="mr-icon"><Play size={18} /></span>
                    <span className="mr-body"><span className="mr-name">Könnyű</span><span className="mr-desc">A bot átlagosan ±6 évet téved — kezdőknek.</span></span>
                  </button>
                  <button type="button" className="mode-row" onClick={() => startBot(3, 'Közepes')}>
                    <span className="mr-icon"><Play size={18} /></span>
                    <span className="mr-body"><span className="mr-name">Közepes</span><span className="mr-desc">±3 év szórás — kiegyenlített meccs.</span></span>
                  </button>
                  <button type="button" className="mode-row" onClick={() => startBot(1.5, 'Nehéz')}>
                    <span className="mr-icon"><Play size={18} /></span>
                    <span className="mr-body"><span className="mr-name">Nehéz</span><span className="mr-desc">±1.5 év — a Gépverő trófea ellenfele.</span></span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );

  const RoomModalView = (
    <AnimatePresence>
          {showRoom && (
            <div className="modal-overlay" onClick={() => setShowRoom(false)}>
              <motion.div
                onClick={(e) => e.stopPropagation()}
                className="modal-box glass settings-modal"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
              >
                <button type="button" className="close-modal" onClick={() => setShowRoom(false)}><X size={22} /></button>
                <h3 className="modal-title">ONLINE SZOBA</h3>
                {netRole === 'host' ? (
                  <>
                    <div className="room-code-big">{roomCode}</div>
                    {qrUrl && (
                      <div className="qr-wrap">
                        <img src={qrUrl} alt="Szoba QR-kód" className="qr-img" />
                        <span className="qr-hint">Olvasd be telefonnal — a kód már ki lesz töltve!</span>
                      </div>
                    )}
                    <button type="button" className="btn-3d ghost small" onClick={shareRoomLink}>
                      LINK MEGOSZTÁSA / MÁSOLÁSA
                    </button>
                    <p className="modal-sub">…vagy írjátok be kézzel a 4 betűs kódot!</p>
                    <div className="audio-mode-row">
                      <button
                        type="button"
                        className={`am-btn ${audioMode === 'own' ? 'on' : ''}`}
                        onClick={() => { setAudioMode('own'); try { localStorage.setItem('cb_audiomode', 'own'); } catch (e) {} }}
                      >
                        <Smartphone size={15} /> SAJÁT TELEFON MÓD
                        <small>a soros játékos telefonján szól a zene</small>
                      </button>
                      <button
                        type="button"
                        className={`am-btn ${audioMode === 'speaker' ? 'on' : ''}`}
                        onClick={() => { setAudioMode('speaker'); try { localStorage.setItem('cb_audiomode', 'speaker'); } catch (e) {} }}
                      >
                        <Volume2 size={15} /> KIHANGOSÍTÓ MÓD
                        <small>a házigazda telefonján szól — a soros játékos indítja a sajátjáról</small>
                      </button>
                    </div>
                    <div className="room-players">
                      {players.filter((p) => p.peerId).length === 0
                        ? <span className="room-wait">Várakozás a csatlakozókra…</span>
                        : players.filter((p) => p.peerId).map((p) => <span key={p.id} className="room-pill">📱 {p.name}</span>)}
                    </div>
                    <button type="button" className="btn-3d ghost small" onClick={leaveRoom}>SZOBA BEZÁRÁSA</button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn-3d gold wide" disabled={netBusy} onClick={createRoom}>
                      {netBusy ? 'KAPCSOLÓDÁS…' : '📡 SZOBA LÉTREHOZÁSA (házigazda)'}
                    </button>
                    <div className="room-divider">vagy csatlakozz</div>
                    <div className="modal-inputs">
                      <input
                        type="text"
                        placeholder="SZOBAKÓD (4 betű)"
                        maxLength={4}
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        style={{ textTransform: 'uppercase', letterSpacing: '4px', textAlign: 'center' }}
                      />
                      <input
                        type="text"
                        placeholder="A neved"
                        maxLength={14}
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                      />
                    </div>
                    <button type="button" className="btn-3d start wide" disabled={netBusy} onClick={joinRoom}>
                      {netBusy ? 'KAPCSOLÓDÁS…' : 'CSATLAKOZÁS 🚀'}
                    </button>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );

  const PackModalView = (
    <AnimatePresence>
          {showPackSelection && (
            <div className="modal-overlay">
              <motion.div
                className="pack-modal glass"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
              >
                <button type="button" className="close-modal" onClick={() => setShowPackSelection(false)}><X size={26} /></button>
                <h2 className="text-chrome">VÁLASSZ STÍLUST</h2>
                <div className="pack-grid">
                  {Object.keys(SONG_PACKS).map((packKey) => (
                    <button
                      key={packKey}
                      className={`pack-card ${selectedPack === packKey ? 'selected' : ''}`}
                      style={{ background: SONG_PACKS[packKey].style }}
                      onClick={() => { setSelectedPack(packKey); setShowPackSelection(false); }}
                    >
                      <h3>{SONG_PACKS[packKey].label}</h3>
                      <p>{SONG_PACKS[packKey].desc}</p>
                      <span className="pack-count">{SONG_PACKS[packKey].data.length} dal</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
  );

  if (status === 'stats') {
    const P = loadProfile();
    const DS = loadDailyStore();
    const decades = Object.keys(P.decades).map(Number).sort((a, b) => a - b);
    const maxA = Math.max(1, ...decades.map((d) => P.decades[d].a));
    return (
      <div className={`app-container ${liteActive ? 'lite' : ''}`}>
        <Backdrop />
        {ToastView}
        <div className="stats-screen">
          <h1 className="text-chrome huge">STATISZTIKA</h1>
          <div className="stat-grid">
            <div className="stat-box glass"><b>{P.m}</b><span>meccs</span></div>
            <div className="stat-box glass"><b>{P.w}</b><span>győzelem</span></div>
            <div className="stat-box glass"><b>{P.placed}</b><span>jó lerakás</span></div>
            <div className="stat-box glass"><b>{P.exact}</b><span>pontos év</span></div>
            <div className="stat-box glass"><b>{DS.streak || 0}</b><span>napi sorozat</span></div>
            <div className="stat-box glass"><b>{DS.best || 0}/10</b><span>napi rekord</span></div>
          </div>

          {decades.length > 0 && (
            <div className="decade-card glass">
              <div className="dc-title">TIPP-PONTOSSÁG ÉVTIZEDENKÉNT</div>
              <div className="dc-bars">
                {decades.map((d) => {
                  const v = P.decades[d];
                  const pct = v.a ? Math.round((v.h / v.a) * 100) : 0;
                  return (
                    <div key={d} className="dc-col">
                      <div className="dc-bar-wrap">
                        <div className="dc-bar" style={{ height: `${Math.max(6, pct)}%`, opacity: 0.45 + 0.55 * (v.a / maxA) }} />
                      </div>
                      <span className="dc-pct">{pct}%</span>
                      <span className="dc-label">{String(d).slice(2)}s</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="ach-card glass">
            <div className="dc-title">TRÓFEÁK ({Object.keys(P.ach).length}/12)</div>
            <div className="ach-grid">
              {ACHIEVEMENTS.map((a) => (
                <div key={a.id} className={`ach-tile ${P.ach[a.id] ? 'got' : ''}`}>
                  <span className="ach-ico">{P.ach[a.id] ? <Trophy size={17} /> : <X size={15} />}</span>
                  <span className="ach-name">{a.name}</span>
                  <span className="ach-desc">{a.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <button type="button" className="btn-3d ghost" onClick={() => setStatus('menu')}>VISSZA</button>
        </div>
      </div>
    );
  }

  // ============================================================
  //  NAPI EREDMENY
  // ============================================================
  if (status === 'daily-result') {
    const store = loadDailyStore();
    const today = todayKey();
    const T = (store.history && store.history[today]) || { score: 0, row: '', tokens: 0 };
    const now = new Date();
    const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
    const mins = Math.max(0, Math.round((midnight - now) / 60000));
    const cd = `${Math.floor(mins / 60)} ó ${mins % 60} p`;
    const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const mPrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    return (
      <div className={`app-container ${liteActive ? 'lite' : ''}`}>
        <Backdrop />
        {ToastView}
        <div className="daily-screen">
          <h1 className="text-chrome huge">NAPI KIHÍVÁS</h1>
          <div className="daily-tabs">
            <button type="button" className={`d-tab ${dailyView === 'result' ? 'on' : ''}`} onClick={() => setDailyView('result')}>EREDMÉNY</button>
            <button type="button" className={`d-tab ${dailyView === 'calendar' ? 'on' : ''}`} onClick={() => setDailyView('calendar')}>NAPTÁR</button>
          </div>

          {dailyView === 'result' ? (
            <div className="daily-card glass">
              <div className="d-score">{T.score}<span>/10</span></div>
              <div className="d-row">
                {T.row.split('').map((c, i) => (
                  <span key={i} className={`d-dot ${c === 'G' ? 'g' : c === 'Y' ? 'y' : 'r'}`} />
                ))}
              </div>
              <div className="d-stats">
                <span><Coins size={14} /> {T.tokens} zseton</span>
                <span>Sorozat: {store.streak || 1} nap</span>
                <span>Rekord: {store.best || T.score}/10</span>
              </div>
              <button type="button" className="btn-3d gold wide" onClick={shareDaily}>EREDMÉNY MEGOSZTÁSA</button>
              <div className="d-countdown">Következő kihívás: {cd} múlva</div>
            </div>
          ) : (
            <div className="daily-card glass">
              <div className="d-month">{now.getFullYear()}. {String(now.getMonth() + 1).padStart(2, '0')}.</div>
              <div className="d-cal">
                {Array.from({ length: monthDays }, (_, i) => {
                  const k = `${mPrefix}${String(i + 1).padStart(2, '0')}`;
                  const h = store.history && store.history[k];
                  return (
                    <span key={k} className={`d-day ${h ? 'played' : ''} ${k === today ? 'today' : ''}`}>
                      {i + 1}
                      {h && <em>{h.score}</em>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <button type="button" className="btn-3d ghost" onClick={() => { dailyRef.current = null; setStatus('menu'); }}>VISSZA A FŐOLDALRA</button>
        </div>
      </div>
    );
  }

  // ============================================================
  //  KLIENS NEZET (csatlakozott telefon)
  // ============================================================
  if (status === 'client') {
    const st = snap;
    const me = st ? st.players.find((p) => p.peerId === myPeerId) : null;
    const active = st && st.players[st.turnIndex];
    const myTurn = !!(st && me && active && active.peerId === myPeerId && st.status === 'game');
    const myChar = me ? CHARACTERS[me.char % CHARACTERS.length] : CHARACTERS[0];
    const canAct = myTurn && !st.flipped && !st.feedback && !st.pending;
    const tl = me ? me.timeline : [];
    return (
      <div className={`app-container ${liteActive ? 'lite' : ''}`}>
        <Backdrop />
        {ToastView}
        {prankFx && prankFx.kind === 'heartbeat' && <div className="fx-heartbeat" />}
        <div className="top-hud">
          <div className="player-info glass" style={{ '--pc': myChar.color }}>
            <div className="hud-avatar"><span>{me ? me.name.charAt(0).toUpperCase() : '?'}</span></div>
            <div className="hud-text">
              <div className="hud-label">TE VAGY</div>
              <div className="hud-name">{me ? me.name : '…'}</div>
            </div>
            <span className="hud-tokens"><Coins size={15} /> {me ? me.tokens : 0}{me && (me.pranks || 0) > 0 && <em className="prank-mini"><Zap size={11} /> {me.pranks}</em>}</span>
          </div>
          <div className="hud-right">
            <div className="deck-chip glass"><DoorOpen size={13} /> {roomCode}</div>
            {st && st.timeLeft !== null && st.timeLeft !== undefined && (
              <div className={`timer-chip glass ${st.timeLeft <= 20 ? 'low' : ''}`}>
                <Timer size={13} /> {Math.floor(st.timeLeft / 60)}:{String(st.timeLeft % 60).padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        <div className="main-arena">
          {!st && <div className="client-banner glass">📡 Kapcsolódva! Várakozás a házigazdára…</div>}
          {st && st.status === 'setup' && <div className="client-banner glass">🛋️ A házigazda még állítgat… mindjárt indulunk!</div>}
          {st && (st.status === 'handoff' || st.status === 'game') && !myTurn && active && (
            <>
              <div className="client-banner glass">
                <span className="cb-big"><Headphones size={17} /> {active.name} játszik…</span>
                <span className="cb-sub">{st.audioMode === 'speaker' ? 'A zene a hangfalon szól!' : `A zene ${active.name} telefonján szól!`}</span>
              </div>
              {st.pending ? (
                <motion.div className="veto-panel glass" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <span className="vp-count">{st.pending.left}</span>
                  <span className="vp-text">{active.name} lerakta a lapot!<br />Szerinted mellément?</span>
                  <button type="button" className="veto-btn" onClick={() => sendAction('veto')}><ShieldAlert size={16} /> VÉTÓ!</button>
                  <span className="vp-warn">Ha tévedsz: -1 zseton + Szégyenfal!</span>
                </motion.div>
              ) : (
                <Pedestal charIndex={active.char} size={150} mood={st.playing ? 'win' : 'idle'} />
              )}
              {me && st.activeModes && st.activeModes.pranks && (me.pranks || 0) > 0 && st.status === 'game' && (
                <div className="prank-bar glass">
                  <span className="pb-title"><Zap size={14} /> SZÍVATÁS ({me.pranks})</span>
                  <div className="pb-btns">
                    <button type="button" className="prank-btn" onClick={() => sendAction('prank', { kind: 'scramble' })}><Zap size={13} /> Rövidzárlat</button>
                    <button type="button" className="prank-btn" onClick={() => sendAction('prank', { kind: 'heartbeat' })}><Vibrate size={13} /> Frász</button>
                  </div>
                </div>
              )}
            </>
          )}
          {st && st.status === 'win' && (
            <div className="client-banner glass">
              <span className="cb-big"><Trophy size={17} /> Vége a meccsnek!</span>
              <span className="cb-sub">Az eredmény a házigazda képernyőjén!</span>
            </div>
          )}
          {myTurn && (
            <>
              <div className="turn-banner">
                <span className="tb-big">{st.pending ? <><ShieldAlert size={20} /> VÉTÓZHATNAK…</> : <><Mic size={20} /> TE JÖSSZ!</>}</span>
                {st.pending && <span className="vp-count">{st.pending.left}</span>}
                {st.goldCard && !st.pending && <span className="gold-badge"><Sparkles size={13} /> ARANY KÁRTYA</span>}
              </div>
              {/* Ugyanaz a szinpad, mint a hazigazdanal: lemezjatszo + rejtelykartya */}
              <div className="music-stage">
                <div className="tt-column">
                  <Turntable
                    isPlaying={st.audioMode === 'speaker' ? !!st.playing : isPlaying}
                    isLoading={!!st.audioLoading}
                    onToggle={clientToggleMusic}
                  />
                  <Equalizer active={st.audioMode === 'speaker' ? !!st.playing : isPlaying} />
                  {st.audioMode === 'speaker' && <span className="cb-sub"><Volume2 size={12} /> A hangfalon szól</span>}
                </div>
                <div className={`card-column ${st.goldCard ? 'gold' : ''}`}>
                  <MysteryCard
                    flipped={!!(st.card && !st.card.masked)}
                    card={st.card && !st.card.masked ? st.card : { y: '', t: '', a: '' }}
                  />
                </div>
              </div>
              {canAct && (
                <div className="client-actions">
                  <motion.button className="bet-fab" whileTap={{ scale: 0.94 }} onClick={() => setClientBet({ year: '', artist: '', title: '' })}>
                    <MessageCircle size={17} /> TIPPELJ ZSETONÉRT!
                  </motion.button>
                  <button type="button" className={`btn-3d swap ${st.audioUrl ? '' : 'error'}`} onClick={() => sendAction('swap')}>
                    <RefreshCw size={16} /> CSERE {SWAP_COST}🪙
                  </button>
                </div>
              )}
              {st.feedback && (
                <div className={`client-banner glass ${st.feedback === 'correct' ? 'good' : 'bad'}`}>
                  <span className="cb-big">{st.feedback === 'correct' ? <><CheckCircle size={17} /> TALÁLT!</> : <><XCircle size={17} /> Nem talált…</>}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sajat idovonal (mindig latszik, sajat korben lerakhato) */}
        <div className="timeline-zone">
          <div className="tl-chip glass">
            <span className="tl-dot" style={{ background: myChar.color, color: myChar.color }} />
            <span className="tl-name">{me ? me.name : ''}</span>
            <div className="tl-progress"><div style={{ width: `${me ? Math.min(100, Math.round((tl.length / WIN_CARDS) * 100)) : 0}%` }} /></div>
            <span className="tl-count">{tl.length}/{WIN_CARDS}</span>
          </div>
          <div className={`timeline-track ${prankFx && prankFx.kind === 'scramble' ? 'scrambled' : ''}`} ref={scrollRef}>
            {canAct && <button className="slot-btn" onClick={() => sendAction('place', { index: 0 })}>+</button>}
            {tl.map((card, i) => (
              <React.Fragment key={`${card.a}-${card.t}-${i}`}>
                <div className="history-card">
                  <div className="year-capsule">{st && st.activeModes && st.activeModes.blind && st.status === 'game' ? '?' : card.y}</div>
                  <div className="history-title">{card.t}</div>
                  <div className="history-artist">{card.a}</div>
                </div>
                {canAct && <button className="slot-btn" onClick={() => sendAction('place', { index: i + 1 })}>+</button>}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Kliens tipp-ablak */}
        <AnimatePresence>
          {clientBet && (
            <div className="modal-overlay" onClick={() => setClientBet(null)}>
              <motion.div
                onClick={(e) => e.stopPropagation()}
                className="modal-box glass"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
              >
                <button type="button" className="close-modal" onClick={() => setClientBet(null)}><X size={22} /></button>
                <h2 className="text-chrome">MI A TIPPED?</h2>
                <div className="modal-inputs">
                  <input type="number" inputMode="numeric" placeholder="Évszám (pl. 2001)" value={clientBet.year}
                    onChange={(e) => setClientBet({ ...clientBet, year: e.target.value })} />
                  <input type="text" placeholder="Előadó" value={clientBet.artist}
                    onChange={(e) => setClientBet({ ...clientBet, artist: e.target.value })} />
                  <input type="text" placeholder="Dal címe" value={clientBet.title}
                    onChange={(e) => setClientBet({ ...clientBet, title: e.target.value })} />
                </div>
                <button className="btn-3d start wide" onClick={() => { sendAction('bet', { data: clientBet }); setClientBet(null); }}>
                  TIPP BEKÜLDÉSE
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {ShameView}
        <button type="button" className="leave-room" onClick={leaveRoom}><X size={14} /> Kilépés</button>
      </div>
    );
  }

  if (status === 'setup') {
    const cur = CHARACTERS[charIndex % CHARACTERS.length];
    return (
      <div className={`app-container ${liteActive ? 'lite' : ''}`}>
        <Backdrop />
        {ToastView}
        {SettingsView}
        {BotModalView}
        {RoomModalView}
        <button type="button" className="gear-btn glass gear-float" onClick={() => setShowSettings(true)} title="Játékmódok">
          <Settings size={19} />
        </button>
        <button type="button" className="back-menu" onClick={() => setStatus('menu')} aria-label="Vissza a főmenübe">‹ FŐMENÜ</button>
        <div className="setup-scroll">
          <div className="setup-card glass">
            <h2 className="setup-title">PARTI-BEÁLLÍTÁS</h2>
            <p className="setup-sub">Adjátok hozzá a játékosokat, aztán indulhat a buli!</p>

            <button
              className="mode-display daily-launcher"
              onClick={() => {
                const st = loadDailyStore();
                if (st.history && st.history[todayKey()]) { setDailyView('result'); setStatus('daily-result'); }
                else startDaily();
              }}
            >
              <span className="mode-label"><Sparkles size={13} /> NAPI KIHÍVÁS</span>
              <span className="mode-count">
                {(() => {
                  const st = loadDailyStore();
                  const t = st.history && st.history[todayKey()];
                  if (t) return `Ma: ${t.score}/10 · Sorozat: ${st.streak || 1} nap — koppints az eredményért`;
                  return st.streak ? `A mai 10 dal mindenkinek ugyanaz! Sorozatod: ${st.streak} nap` : 'A mai 10 dal mindenkinek ugyanaz — 3 élet, hajrá!';
                })()}
              </span>
            </button>

            

            

            <button className="mode-display" onClick={() => setShowRoom(true)}>
              <span className="mode-label"><Smartphone size={13} /> ONLINE SZOBA</span>
              <span className="mode-count">
                {netRole === 'host'
                  ? <>Szobakód: <b className="room-code-inline">{roomCode}</b> · {players.filter((p) => p.peerId).length} telefon csatlakozva</>
                  : 'Hozz létre szobát, vagy csatlakozz kóddal!'}
              </span>
            </button>

            {netRole === 'host' && (
              <div className="room-inline glass">
                <Smartphone size={13} /> Szoba él: <b>{roomCode}</b> · {players.filter((p) => p.peerId).length} telefon
              </div>
            )}
            <button className="mode-display" onClick={() => setShowSettings(true)}>
              <span className="mode-label"><Settings size={13} /> JÁTÉKMÓDOK</span>
              <span className="mode-count">
                {(modes.blind || modes.speed || modes.gold || modes.reverse)
                  ? <>Aktív: {[modes.blind && 'Blind', modes.speed && 'Speed', modes.gold && 'Arany Kártya', modes.reverse && 'Reverse', modes.veto && 'Vétó', modes.pranks && 'Szívatás'].filter(Boolean).join(' · ')}</>
                  : 'Nincs extra mód — koppints a beállításhoz'}
              </span>
            </button>

            <div className="avatar-picker">
              <button className="arrow-btn" onClick={() => setCharIndex((p) => (p - 1 + CHARACTERS.length) % CHARACTERS.length)}>‹</button>
              <Pedestal charIndex={charIndex} size={170} />
              <button className="arrow-btn" onClick={() => setCharIndex((p) => (p + 1) % CHARACTERS.length)}>›</button>
            </div>
            <div className="avatar-tip">Forgasd meg az ujjaddal! 👆</div>

            <div className="setup-form">
              <input
                className="name-input"
                placeholder="JÁTÉKOS NEVE"
                value={newName}
                maxLength={14}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }}
              />
              <button className="btn-3d add" onClick={addPlayer}>+</button>
            </div>

            <div className="player-list-setup">
              {players.map((p) => (
                <div key={p.id} className="player-chip">
                  <span className="dot" style={{ background: CHARACTERS[p.char % CHARACTERS.length].color }} />
                  <span>{p.name}</span>
                  <button className="chip-x" onClick={() => removePlayer(p.id)}><X size={13} /></button>
                </div>
              ))}
            </div>

            {players.length > 0 && (
              <button className="btn-3d start" onClick={startGame}>
                START <ChevronRight size={22} />
              </button>
            )}
          </div>
        </div>

        {PackModalView}
      </div>
    );
  }

  // ============================================================
  //  HANDOFF
  // ============================================================
  if (status === 'handoff') {
    const p = players[turnIndex];
    const c = CHARACTERS[p.char % CHARACTERS.length];
    return (
      <div className={`app-container ${liteActive ? 'lite' : ''}`}>
        <Backdrop />
        {ToastView}
        <motion.div
          className="handoff"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="handoff-label" style={{ color: c.color, textShadow: `0 0 14px ${c.color}` }}>
            KÖVETKEZŐ JÁTÉKOS
          </div>
          <Pedestal charIndex={p.char} size={210} />
          <h1 className="text-chrome huge">{p.name}</h1>
          <div className="handoff-stats">
            <span><Layers size={15} /> {p.timeline.length}/{WIN_CARDS} kártya</span>
            <span className="gold"><Coins size={15} /> {p.tokens} zseton</span>
          </div>
          <button className="btn-3d start" onClick={() => setStatus('game')}>
            KEZDHETEM <ChevronRight size={22} />
          </button>
          <div className="handoff-sub">Add át neki a telefont!</div>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  //  GYOZELMI KEPERNYO
  // ============================================================
  if (status === 'win') {
    const standings = [...players].sort(
      (a, b) => b.timeline.length - a.timeline.length || b.tokens - a.tokens
    );
    const winner = standings[0];
    const winnerChar = CHARACTERS[winner.char % CHARACTERS.length];
    const biggestMiss = [...players].sort((a, b) => (b.worstMiss || 0) - (a.worstMiss || 0))[0];
    return (
      <div className={`app-container ${liteActive ? 'lite' : ''}`}>
        <Backdrop />
        {ToastView}
        <div className="win-scroll">
          <div className="win-content">
            <div className="win-trophy"><Trophy size={38} /></div>
            <h1 className="text-chrome huge">GYŐZTES</h1>
            <h2 className="winner-name" style={{ color: winnerChar.color, textShadow: `0 0 20px ${winnerChar.color}` }}>
              {winner.name}
            </h2>
            {endReason === 'deck' && <div className="deck-note">Elfogyott a pakli — a leghosszabb idővonal nyert!</div>}
            {endReason === 'time' && <div className="deck-note">⏱ Lejárt a 2 perc — a leghosszabb idővonal nyert!</div>}

            <Pedestal charIndex={winner.char} size={200} mood="win" />

            <div className="standings">
              {standings.map((p, i) => {
                const pc = CHARACTERS[p.char % CHARACTERS.length];
                return (
                  <div key={p.id} className={`stand-row ${i === 0 ? 'first' : ''}`}>
                    <span className="stand-place">{i + 1}.</span>
                    <span className="dot" style={{ background: pc.color }} />
                    <span className="stand-name">{p.name}</span>
                    <span className="stand-score">{p.timeline.length} 🎵 · {p.tokens} 🪙</span>
                  </div>
                );
              })}
            </div>

            {biggestMiss && biggestMiss.worstMiss > 0 && (
              <div className="fun-stat">
                🎯 Legnagyobb mellélövés: <b>{biggestMiss.name}</b> ({biggestMiss.worstMiss} évet tévedett!)
              </div>
            )}

            <div className="win-buttons">
              <button className="btn-3d gold" onClick={shareResultCard}><Trophy size={18} /> EREDMÉNYKÉP MEGOSZTÁSA</button>
              <button className="btn-3d start" onClick={rematch}><RefreshCw size={18} /> VISSZAVÁGÓ</button>
              <button className="btn-3d ghost" onClick={backToSetup}>ÚJ CSAPAT</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  //  JATEK KEPERNYO
  // ============================================================
  const activePlayer = players[turnIndex];
  const activeChar = CHARACTERS[activePlayer.char % CHARACTERS.length];
  const tl = activePlayer.timeline;
  const isAudioBroken = !audioUrl && !isLoading;
  const slotsDisabled = flipped || !!feedback;
  const progress = Math.min(100, Math.round((tl.length / WIN_CARDS) * 100));

  const GhostCard = (
    <div ref={ghostRef} className="ghost-card">
      <div className="ghost-arrow">IDE KELLETT VOLNA</div>
      <div className="year-capsule red">{currentCard ? currentCard.y : ''}</div>
      <div className="history-title">{currentCard ? currentCard.t : ''}</div>
    </div>
  );

  return (
    <div className={`app-container in-game ${liteActive ? 'lite' : ''} ${shake ? 'shake' : ''} ${feedback === 'correct' ? 'winpulse' : ''}`}>
      <Backdrop />
      <div className="ver-tag">{APP_VERSION}</div>
      {ToastView}
      {feedback && <div className={`fx-overlay ${feedback === 'correct' ? 'good' : 'bad'}`} />}
      {prankFx && prankFx.kind === 'heartbeat' && <div className="fx-heartbeat" />}
      <AnimatePresence>
        {flight && (
          <motion.div
            key={flight.id}
            className="fly-card"
            initial={{
              left: flight.from.left + flight.from.width / 2,
              top: flight.from.top + flight.from.height / 2,
              scale: 1,
              rotateY: 0,
              opacity: 1,
            }}
            animate={{
              left: flight.to.left + flight.to.width / 2,
              top: flight.to.top + flight.to.height / 2,
              scale: 0.55,
              rotateY: 360,
              opacity: 1,
            }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.85, ease: [0.2, 0.9, 0.3, 1] }}
          >
            <div className="fly-face">
              <span className="fly-year">{flight.card.y}</span>
              <span className="fly-title">{flight.card.t}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {ShameView}
      {pendingPlace && (
        <div className="veto-strip glass">
          <span className="vp-count">{pendingLeft}</span>
          <span className="vp-text">{activePlayer.name} lerakta a lapot — ki vétóz?</span>
          <div className="veto-pickers">
            {players.map((p, i) => (!p.peerId && i !== turnIndex ? (
              <button key={p.id} type="button" className="veto-btn small" onClick={() => hostVeto(i)}>
                <ShieldAlert size={13} /> {p.name}
              </button>
            ) : null))}
          </div>
        </div>
      )}
      {TutorialView}
      {SettingsView}

      {/* ---------- FELSO HUD ---------- */}
      <div className="top-hud">
        <div className="player-info glass" style={{ '--pc': activeChar.color }}>
          <div className="hud-avatar">
            <span>{activePlayer.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="hud-text">
            <div className="hud-label">SZÍNPADON</div>
            <div className="hud-name">{activePlayer.name}</div>
          </div>
          <motion.span
            key={activePlayer.tokens}
            initial={{ scale: 1.6, rotate: -14 }}
            animate={{ scale: 1, rotate: 0 }}
            className="hud-tokens"
          >
            <Coins size={15} /> {activePlayer.tokens}
          </motion.span>
        </div>
        <div className="hud-right">
          {timeLeft !== null && (
            <div className={`timer-chip glass ${timeLeft <= 20 ? 'low' : ''}`}>
              <Timer size={13} /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          )}
          {dailyRef.current ? (
            <div className="deck-chip glass daily-chip" title="Napi kihívás">
              {dailyRef.current.idx + 1}/10 · {'♥'.repeat(Math.max(0, dailyRef.current.lives))}{'♡'.repeat(Math.max(0, 3 - dailyRef.current.lives))}
            </div>
          ) : (
            <div className="deck-chip glass" title="Hátralévő kártyák"><Layers size={13} /> {cardsLeft}</div>
          )}
          {(activeModes.blind || activeModes.speed || activeModes.gold || activeModes.reverse) && (
            <div className="deck-chip glass" title="Aktív játékmódok">
              {activeModes.blind && <EyeOff size={13} />}{activeModes.speed && <Timer size={13} />}{activeModes.gold && <Sparkles size={13} />}{activeModes.reverse && <Rewind size={13} />}{activeModes.veto && <ShieldAlert size={13} />}{activeModes.pranks && <Zap size={13} />}
            </div>
          )}
          <button
            className={`btn-3d swap ${isAudioBroken ? 'error' : ''}`}
            onClick={handleSwap}
            disabled={slotsDisabled}
          >
            {isAudioBroken ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}
            {isAudioBroken ? ' INGYEN CSERE' : ` CSERE ${SWAP_COST}🪙`}
          </button>
        </div>
      </div>

      {/* ---------- SZINPAD ---------- */}
      <div className="main-arena">
        <div className="game-char">
          <CharacterStage charIndex={activePlayer.char} size={96} mood={isPlaying ? 'win' : 'idle'} />
          <div className="gc-disc" style={{ '--pc': activeChar.color }} />
        </div>
        <div className="music-stage">
          <div className="tt-column">
            <Turntable isPlaying={isPlaying} isLoading={isLoading} onToggle={toggleMusic} />
            <Equalizer active={isPlaying} />
          </div>
          <div className={`card-column ${goldCard ? 'gold' : ''}`} ref={stageCardRef}>
            {goldCard && <div className="gold-badge"><Sparkles size={13} /> ARANY KÁRTYA</div>}
            <MysteryCard flipped={flipped} card={currentCard} />
            <AnimatePresence>
              {betResult && (
                <motion.div
                  className={`bet-result ${betResult.total > 0 ? 'good' : 'bad'}`}
                  initial={{ y: 16, opacity: 0, scale: 0.85 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                >
                  {betResult.total > 0
                    ? `+${betResult.total} 🪙${betResult.exactYear ? ' · PONTOS ÉV!' : ''}`
                    : 'Nem talált 😅'}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {!flipped && (
          <motion.button
            className="bet-fab"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setShowBetModal(true)}
          >
            <MessageCircle size={17} /> TIPPELJ ZSETONÉRT!
          </motion.button>
        )}

        <AnimatePresence>
          {tripleMiss && (
            <motion.div
              className="triple-miss"
              initial={{ scale: 0.2, opacity: 0, rotate: -18 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 2.4, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            >
              <span className="tm-face">🤡</span>
              <span className="tm-text">HÁROM MELLÉ!</span>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={`feedback-popup ${feedback}`}
            >
              {feedback === 'correct'
                ? <CheckCircle size={110} color="#00ff87" />
                : <XCircle size={110} color="#ff2255" />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------- IDOVONAL ---------- */}
      <div className="timeline-dock">
        <div className="tl-header glass">
          <span className="tl-dot" style={{ background: activeChar.color }} />
          <span className="tl-name">{activePlayer.name}</span>
          <div className="tl-progress"><div style={{ width: `${progress}%` }} /></div>
          <span className="tl-count">{tl.length}/{WIN_CARDS}</span>
        </div>
        <div className="tl-perspective">
          <div className={`timeline-track ${prankFx && prankFx.kind === 'scramble' ? 'scrambled' : ''}`} ref={scrollRef}>
            {feedback !== 'wrong' && (
              <button className="slot-btn" disabled={slotsDisabled} onClick={(e) => handlePlace(0, e)}>+</button>
            )}
            {tl.map((card, i) => (
              <React.Fragment key={`${card.a}-${card.t}-${i}`}>
                {feedback === 'wrong' && wrongIndex === i && GhostCard}
                <div className="history-card">
                  <div className="year-capsule">{activeModes.blind && status === 'game' ? '?' : card.y}</div>
                  <div className="history-title">{card.t}</div>
                  <div className="history-artist">{card.a}</div>
                </div>
                {feedback !== 'wrong' && (
                  <button className="slot-btn" disabled={slotsDisabled} onClick={(e) => handlePlace(i + 1, e)}>+</button>
                )}
              </React.Fragment>
            ))}
            {feedback === 'wrong' && wrongIndex === tl.length && GhostCard}
          </div>
        </div>
      </div>

      {/* ---------- TIPP MODAL ---------- */}
      <AnimatePresence>
        {showBetModal && (
          <div className="modal-overlay" onClick={() => setShowBetModal(false)}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              className="modal-box glass"
              initial={{ scale: 0.85, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
            >
              <button type="button" className="close-modal" onClick={() => setShowBetModal(false)}><X size={22} /></button>
              <h2 className="text-chrome">MI A TIPPED?</h2>
              {goldCard && <div className="gold-badge inmodal"><Sparkles size={13} /> ARANY KÁRTYA — DUPLA NYEREMÉNY!</div>}
              <p className="modal-sub">
                Év ±{YEAR_TOLERANCE}: 1🪙 · pontos év: 2🪙 · előadó / cím: 1-1🪙
              </p>
              {SR && (
                <button
                  type="button"
                  className={`mic-btn ${micOn ? 'live' : ''}`}
                  onPointerDown={micStart}
                  onPointerUp={micStop}
                  onPointerLeave={micStop}
                >
                  <Mic size={18} />
                  {micOn ? ' HALLGATLAK…' : ' TARTSD NYOMVA ÉS MONDD BE!'}
                </button>
              )}
              <div className="modal-inputs">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Évszám (pl. 2001)"
                  value={betData.year}
                  onChange={(e) => setBetData({ ...betData, year: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Előadó"
                  value={betData.artist}
                  onChange={(e) => setBetData({ ...betData, artist: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Dal címe"
                  value={betData.title}
                  onChange={(e) => setBetData({ ...betData, title: e.target.value })}
                />
              </div>
              <button className="btn-3d start wide" onClick={checkBet}>TIPP BEKÜLDÉSE</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}