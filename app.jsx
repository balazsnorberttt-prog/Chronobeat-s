import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, X, XCircle, CheckCircle, RefreshCw, Coins,
  MessageCircle, AlertTriangle, Trophy, Layers, ChevronRight,
  Settings, Mic, BookOpen, Timer, EyeOff, Rewind, Sparkles,
  ShieldAlert, Zap, Vibrate, Smartphone, Volume2, Headphones, DoorOpen, Info, Download, Share,
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
  { name: 'DJ',        color: '#00eaff', buddy: { skin: '#ffd9b3', shirt: '#00b8d4', pants: '#1a1440', hat: 'headphones', glasses: 'none',   extra: 'none',   hair: '#2b1a12', accent: '#7ef3ff', prop: 'vinyl',      dance: 'bounce',   build: 'normal', face: 'grin' } },
  { name: 'Rocker',    color: '#ff0055', buddy: { skin: '#ffd9b3', shirt: '#1c1c24', pants: '#33334a', hat: 'mohawk',     glasses: 'shades', extra: 'none',   hair: '#ff0055', accent: '#ff4d85', prop: 'guitar',     dance: 'headbang', build: 'slim',   face: 'cool' } },
  { name: 'Díva',      color: '#ffd700', buddy: { skin: '#8a5a3b', shirt: '#ffd700', pants: '#7b2dff', hat: 'afro',       glasses: 'star',   extra: 'none',   hair: '#2b1a12', accent: '#fff0a0', prop: 'mic',        dance: 'sway',     build: 'normal', face: 'wink' } },
  { name: 'Rapper',    color: '#00ff87', buddy: { skin: '#6f4a2f', shirt: '#0f8a4f', pants: '#101018', hat: 'cap',        glasses: 'none',   extra: 'chain',  hair: '#101010', accent: '#6dffb8', prop: 'mic',        dance: 'bounce',   build: 'round',  face: 'cool' } },
  { name: 'Metálos',   color: '#b385ff', buddy: { skin: '#e8c39e', shirt: '#181820', pants: '#181820', hat: 'longhair',   glasses: 'none',   extra: 'none',   hair: '#241a30', accent: '#b385ff', prop: 'guitar',     dance: 'headbang', build: 'tall',   face: 'openMouth' } },
  { name: 'Nagyi',     color: '#ff9ad1', buddy: { skin: '#f2c9a0', shirt: '#c46aff', pants: '#4a2a6e', hat: 'bun',        glasses: 'round',  extra: 'bow',    hair: '#d9d9e8', accent: '#ffc2e6', prop: 'tambourine', dance: 'sway',     build: 'round',  face: 'smile' } },
  { name: 'Kocka',     color: '#5da9ff', buddy: { skin: '#ffd9b3', shirt: '#2f6fdd', pants: '#26304a', hat: 'flat',       glasses: 'square', extra: 'bowtie', hair: '#6b4a2a', accent: '#9ecbff', prop: 'keytar',     dance: 'robot',    build: 'slim',   face: 'smile' } },
  { name: 'Punk',      color: '#7dff6a', buddy: { skin: '#e8c39e', shirt: '#243024', pants: '#182018', hat: 'spikes',     glasses: 'none',   extra: 'chain',  hair: '#7dff6a', accent: '#a8ff9c', prop: 'drumsticks', dance: 'jump',     build: 'normal', face: 'grin' } },
  { name: 'Kingsztár', color: '#fff35d', buddy: { skin: '#f0c9a0', shirt: '#f4f4ff', pants: '#c9a227', hat: 'quiff',      glasses: 'gold',   extra: 'none',   hair: '#1a1a22', accent: '#ffe98a', prop: 'mic',        dance: 'sway',     build: 'normal', face: 'wink' } },
  { name: 'Rasta',     color: '#ffb020', buddy: { skin: '#7a5236', shirt: '#c8102e', pants: '#0a6a2f', hat: 'dreads',     glasses: 'none',   extra: 'none',   hair: '#2b1a12', accent: '#ffd36a', prop: 'maracas',    dance: 'sway',     build: 'normal', face: 'smile' } },
  { name: 'Robó',      color: '#9be9ff', buddy: { skin: '#b9c6d9', shirt: '#8fa1bd', pants: '#5b6a85', hat: 'antenna',    glasses: 'visor',  extra: 'none',   hair: '#8fa1bd', accent: '#9be9ff', prop: 'boombox',    dance: 'robot',    build: 'normal', face: 'robot' } },
  { name: 'Popsztár',  color: '#ff5dde', buddy: { skin: '#ffd9b3', shirt: '#ff5dde', pants: '#3a1440', hat: 'crown',      glasses: 'none',   extra: 'none',   hair: '#5a3a1a', accent: '#ffa8ef', prop: 'mic',        dance: 'spin',     build: 'slim',   face: 'grin' } },
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
  const notes = useRef();

  const C = cfg;
  const hair = C.hair || '#3a2a1a';
  const accent = C.accent || '#ffffff';
  const dance = C.dance || 'bounce';
  const face = C.face || 'smile';
  const build = C.build || 'normal';
  const prop = C.prop || 'none';

  // Testalkat-aranyok: minden figura mas sziluettet kap
  const B =
    build === 'round' ? { w: 1.18, h: 0.94, hd: 1.06, leg: 0.86 } :
    build === 'slim' ? { w: 0.86, h: 1.06, hd: 0.96, leg: 1.12 } :
    build === 'tall' ? { w: 0.92, h: 1.14, hd: 0.9, leg: 1.2 } :
    { w: 1, h: 1, hd: 1, leg: 1 };

  const HR = 0.52 * B.hd;
  const HY = 0.3 * B.h;
  const handProp = prop === 'mic' || prop === 'vinyl' || prop === 'drumsticks' || prop === 'maracas' || prop === 'tambourine';
  const bodyProp = prop === 'guitar' || prop === 'keytar' || prop === 'boombox';

  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const on = mood === 'win';
    const sp = on ? 6.2 : 2.0;
    const amp = on ? 1 : 0.26;

    let by = 0, bz = 0, bry = 0, hx = 0, hz = 0;
    let alz = 0.3, arz = -0.3, ax = 0;

    if (dance === 'headbang') {
      by = Math.abs(Math.sin(t * sp)) * 0.055 * amp;
      hx = Math.sin(t * sp * 1.1) * 0.4 * amp + 0.04;
      alz = 0.3 + 1.7 * amp; arz = -0.3 - 1.7 * amp;
    } else if (dance === 'sway') {
      by = Math.sin(t * sp * 2) * 0.032 * amp;
      bz = Math.sin(t * sp) * 0.12 * amp;
      hz = -Math.sin(t * sp) * 0.1 * amp;
      alz = 0.35 + Math.sin(t * sp) * 0.6 * amp;
      arz = -0.35 + Math.sin(t * sp) * 0.6 * amp;
    } else if (dance === 'jump') {
      const j = Math.max(0, Math.sin(t * sp));
      by = j * 0.28 * amp;
      hx = -j * 0.13 * amp;
      alz = 0.3 + j * 2.1 * amp; arz = -0.3 - j * 2.1 * amp;
    } else if (dance === 'robot') {
      const q = Math.round(Math.sin(t * sp) * 3) / 3;
      by = Math.abs(q) * 0.038 * amp;
      bry = q * 0.28 * amp;
      hz = q * 0.15 * amp;
      alz = 0.3 + (q > 0 ? 1.4 : 0) * amp;
      arz = -0.3 - (q < 0 ? 1.4 : 0) * amp;
    } else if (dance === 'spin') {
      by = Math.sin(t * sp * 2) * 0.05 * amp;
      bry = on ? t * 1.4 : Math.sin(t * sp) * 0.18;
      alz = 0.4 + Math.sin(t * sp) * 0.95 * amp;
      arz = -0.4 - Math.cos(t * sp) * 0.95 * amp;
    } else {
      by = Math.sin(t * sp) * 0.07 * amp;
      hx = Math.sin(t * sp) * 0.15 * amp;
      hz = Math.sin(t * sp * 0.5) * 0.06;
      alz = 0.3 + Math.sin(t * sp) * 1.5 * amp;
      arz = -0.3 - Math.cos(t * sp) * 1.5 * amp;
    }

    // Hangszert tarto kezek nyugodtabbak
    if (handProp) arz = -0.5 - Math.abs(Math.sin(t * sp)) * 0.3 * amp;
    if (bodyProp) {
      alz = 0.72 + Math.sin(t * sp) * 0.1 * amp;
      arz = -0.72 - Math.sin(t * sp) * 0.1 * amp;
      ax = -0.55;
    }

    if (body.current) {
      body.current.position.y = 0.04 + by;
      body.current.rotation.z = bz;
      body.current.rotation.y = bry;
    }
    if (head.current) { head.current.rotation.x = hx; head.current.rotation.z = hz; }
    if (armL.current) { armL.current.rotation.z = alz; armL.current.rotation.x = ax; }
    if (armR.current) { armR.current.rotation.z = arz; armR.current.rotation.x = ax; }
    if (notes.current) {
      notes.current.rotation.y = t * 0.85;
      notes.current.position.y = 0.5 + Math.sin(t * 1.7) * 0.1;
    }
  });

  const noteColors = ['#00eaff', '#ff5dde', '#ffd36a'];

  return (
    <group>
      <group ref={body} scale={1.12}>
        {/* ---- Labak + reszletes cipok ---- */}
        {[-0.17 * B.w, 0.17 * B.w].map((x, i) => (
          <group key={i}>
            <mesh position={[x, -0.78 * B.leg, 0]}>
              <capsuleGeometry args={[0.115, 0.14, 6, 12]} />
              <meshStandardMaterial color={C.pants} roughness={0.72} />
            </mesh>
            <mesh position={[x, -0.935 * B.leg, 0.05]} scale={[1, 0.5, 1.5]}>
              <sphereGeometry args={[0.135, 14, 12]} />
              <meshStandardMaterial color="#f6f6ff" roughness={0.38} />
            </mesh>
            <mesh position={[x, -0.9 * B.leg, 0.09]} scale={[0.94, 0.4, 1.1]}>
              <sphereGeometry args={[0.12, 12, 10]} />
              <meshStandardMaterial color={accent} roughness={0.45} />
            </mesh>
          </group>
        ))}

        {/* ---- Torzs, ov, gallér ---- */}
        <mesh position={[0, -0.42 * B.h, 0]} scale={[B.w, 1, B.w]}>
          <capsuleGeometry args={[0.34, 0.24, 8, 18]} />
          <meshStandardMaterial color={C.shirt} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.36 * B.h, 0.27 * B.w]} scale={[0.28, 1, 0.3]}>
          <capsuleGeometry args={[0.3, 0.2, 6, 12]} />
          <meshStandardMaterial color={accent} roughness={0.45} />
        </mesh>
        <mesh position={[0, -0.64 * B.h, 0]} scale={[B.w, 1, B.w]}>
          <cylinderGeometry args={[0.348, 0.348, 0.1, 20]} />
          <meshStandardMaterial color={C.pants} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.64 * B.h, 0.3 * B.w]}>
          <boxGeometry args={[0.12, 0.085, 0.045]} />
          <meshStandardMaterial color="#f5b91e" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.2 * B.h, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[B.w, B.w, 1]}>
          <torusGeometry args={[0.21, 0.055, 8, 20]} />
          <meshStandardMaterial color={accent} roughness={0.5} />
        </mesh>

        {/* ---- Karok: ujj + kez ---- */}
        <group ref={armL} position={[-0.38 * B.w, -0.26 * B.h, 0]}>
          <mesh position={[0, -0.08, 0]}>
            <capsuleGeometry args={[0.098, 0.07, 6, 12]} />
            <meshStandardMaterial color={accent} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.078, 0.13, 6, 12]} />
            <meshStandardMaterial color={C.skin} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color={C.skin} roughness={0.55} />
          </mesh>
        </group>

        <group ref={armR} position={[0.38 * B.w, -0.26 * B.h, 0]}>
          <mesh position={[0, -0.08, 0]}>
            <capsuleGeometry args={[0.098, 0.07, 6, 12]} />
            <meshStandardMaterial color={accent} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <capsuleGeometry args={[0.078, 0.13, 6, 12]} />
            <meshStandardMaterial color={C.skin} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color={C.skin} roughness={0.55} />
          </mesh>

          {prop === 'mic' && (
            <group position={[0, -0.44, 0.08]} rotation={[0.5, 0, 0]}>
              <mesh><cylinderGeometry args={[0.032, 0.042, 0.2, 10]} /><meshStandardMaterial color="#22222c" roughness={0.4} /></mesh>
              <mesh position={[0, 0.145, 0]}><sphereGeometry args={[0.072, 12, 10]} /><meshStandardMaterial color="#9aa2c4" metalness={0.7} roughness={0.24} /></mesh>
            </group>
          )}
          {prop === 'vinyl' && (
            <group position={[0, -0.46, 0.05]} rotation={[0.28, 0, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.24, 0.24, 0.022, 24]} /><meshStandardMaterial color="#14101c" roughness={0.32} /></mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}><cylinderGeometry args={[0.09, 0.09, 0.026, 20]} /><meshStandardMaterial color={accent} roughness={0.4} /></mesh>
            </group>
          )}
          {prop === 'drumsticks' && (
            <group position={[0, -0.44, 0.04]} rotation={[0, 0, -0.35]}>
              {[-0.05, 0.05].map((x, i) => (
                <mesh key={i} position={[x, 0.08, 0]} rotation={[0, 0, i ? 0.16 : -0.16]}>
                  <cylinderGeometry args={[0.022, 0.028, 0.44, 8]} />
                  <meshStandardMaterial color="#d9b382" roughness={0.6} />
                </mesh>
              ))}
            </group>
          )}
          {prop === 'maracas' && (
            <group position={[0, -0.46, 0.04]}>
              <mesh position={[0, -0.06, 0]}><cylinderGeometry args={[0.026, 0.032, 0.17, 8]} /><meshStandardMaterial color="#8a5a3b" roughness={0.6} /></mesh>
              <mesh position={[0, 0.085, 0]}><sphereGeometry args={[0.11, 14, 12]} /><meshStandardMaterial color={accent} roughness={0.42} /></mesh>
            </group>
          )}
          {prop === 'tambourine' && (
            <group position={[0, -0.46, 0.05]} rotation={[0.32, 0, 0.3]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.18, 0.036, 10, 22]} /><meshStandardMaterial color={accent} roughness={0.45} /></mesh>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const a = (i / 6) * Math.PI * 2;
                return (
                  <mesh key={i} position={[Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18]}>
                    <sphereGeometry args={[0.033, 8, 6]} />
                    <meshStandardMaterial color="#f5b91e" metalness={0.8} roughness={0.3} />
                  </mesh>
                );
              })}
            </group>
          )}
        </group>

        {/* ---- Testre szerelt hangszerek ---- */}
        {prop === 'guitar' && (
          <group position={[0.05, -0.52 * B.h, 0.3]} rotation={[0.22, -0.14, -0.72]}>
            <mesh scale={[1, 1.35, 0.32]}><sphereGeometry args={[0.24, 16, 14]} /><meshStandardMaterial color={accent} roughness={0.28} metalness={0.18} /></mesh>
            <mesh position={[0, 0.05, 0.085]} scale={[1, 1, 0.22]}><sphereGeometry args={[0.075, 12, 10]} /><meshStandardMaterial color="#160f16" roughness={0.85} /></mesh>
            <mesh position={[0, 0.54, 0]}><boxGeometry args={[0.085, 0.64, 0.055]} /><meshStandardMaterial color="#5a3a1a" roughness={0.6} /></mesh>
            <mesh position={[0, 0.92, 0]}><boxGeometry args={[0.12, 0.17, 0.06]} /><meshStandardMaterial color="#2a1a10" roughness={0.5} /></mesh>
          </group>
        )}
        {prop === 'keytar' && (
          <group position={[0, -0.5 * B.h, 0.34]} rotation={[0.2, 0, -0.12]}>
            <mesh><boxGeometry args={[0.68, 0.13, 0.17]} /><meshStandardMaterial color="#1a1a26" roughness={0.4} /></mesh>
            {[-0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24].map((x, i) => (
              <mesh key={i} position={[x, 0.078, 0.02]}>
                <boxGeometry args={[0.06, 0.022, 0.115]} />
                <meshStandardMaterial color={i % 3 === 1 ? '#22222c' : '#f2f2f8'} roughness={0.35} />
              </mesh>
            ))}
            <mesh position={[0.41, 0.02, 0]}><boxGeometry args={[0.16, 0.11, 0.14]} /><meshStandardMaterial color={accent} roughness={0.4} /></mesh>
          </group>
        )}
        {prop === 'boombox' && (
          <group position={[0, -0.5 * B.h, 0.37]}>
            <mesh><boxGeometry args={[0.64, 0.35, 0.16]} /><meshStandardMaterial color="#2a3242" roughness={0.45} metalness={0.22} /></mesh>
            {[-0.17, 0.17].map((x, i) => (
              <group key={i} position={[x, -0.02, 0.085]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.115, 0.115, 0.03, 18]} /><meshStandardMaterial color="#12161f" roughness={0.6} /></mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}><cylinderGeometry args={[0.05, 0.05, 0.03, 14]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} /></mesh>
              </group>
            ))}
            <mesh position={[0, 0.15, 0.085]}><boxGeometry args={[0.24, 0.07, 0.02]} /><meshStandardMaterial color="#0d1018" roughness={0.5} /></mesh>
            <mesh position={[0, 0.23, 0]}><torusGeometry args={[0.2, 0.022, 8, 18, Math.PI]} /><meshStandardMaterial color="#5b6a85" metalness={0.6} roughness={0.35} /></mesh>
          </group>
        )}

        {C.extra === 'chain' && (
          <mesh position={[0, -0.22 * B.h, 0.27 * B.w]} rotation={[1.3, 0, 0]}>
            <torusGeometry args={[0.17, 0.032, 10, 22]} />
            <meshStandardMaterial color="#ffd700" metalness={0.85} roughness={0.22} />
          </mesh>
        )}
        {C.extra === 'bowtie' && (
          <group position={[0, -0.17 * B.h, 0.31 * B.w]}>
            {[-0.08, 0.08].map((x, i) => (
              <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, x > 0 ? -0.5 : 0.5]} scale={[1.4, 0.8, 0.5]}>
                <sphereGeometry args={[0.06, 8, 8]} />
                <meshStandardMaterial color="#ff0055" roughness={0.45} />
              </mesh>
            ))}
          </group>
        )}

        {/* ================= FEJ ================= */}
        <group ref={head} position={[0, HY, 0]}>
          <mesh>
            <sphereGeometry args={[HR, 26, 22]} />
            <meshStandardMaterial color={C.skin} roughness={0.55} />
          </mesh>

          {/* Szemek - arckifejezes szerint */}
          {C.glasses !== 'visor' && [-0.18, 0.18].map((x, i) => {
            const closed = face === 'wink' && i === 0;
            return (
              <group key={i} position={[x, 0.04, 0]}>
                {closed ? (
                  <mesh position={[0, 0, HR * 0.9]} rotation={[0, 0, 0.12]}>
                    <boxGeometry args={[0.17, 0.03, 0.02]} />
                    <meshStandardMaterial color="#141420" />
                  </mesh>
                ) : face === 'robot' ? (
                  <mesh position={[0, 0, HR * 0.88]}>
                    <boxGeometry args={[0.18, 0.105, 0.03]} />
                    <meshStandardMaterial color="#00eaff" emissive="#00b8d4" emissiveIntensity={1.15} />
                  </mesh>
                ) : (
                  <group>
                    <mesh position={[0, 0, HR * 0.86]}><sphereGeometry args={[0.108, 14, 12]} /><meshStandardMaterial color="#ffffff" roughness={0.16} /></mesh>
                    <mesh position={[0, 0, HR * 0.98]}><sphereGeometry args={[0.053, 10, 8]} /><meshStandardMaterial color="#141420" roughness={0.2} /></mesh>
                    <mesh position={[0.03, 0.034, HR * 1.05]}><sphereGeometry args={[0.02, 8, 6]} /><meshStandardMaterial color="#ffffff" /></mesh>
                    <mesh position={[-0.025, -0.028, HR * 1.04]}><sphereGeometry args={[0.011, 6, 6]} /><meshStandardMaterial color="#ffffff" /></mesh>
                  </group>
                )}
              </group>
            );
          })}

          {/* Szemoldok */}
          {(face === 'cool' || face === 'openMouth' || face === 'grin') && [-0.18, 0.18].map((x, i) => (
            <mesh key={'br' + i} position={[x, 0.205, HR * 0.85]} rotation={[0, 0, i === 0 ? 0.26 : -0.26]}>
              <boxGeometry args={[0.16, 0.034, 0.02]} />
              <meshStandardMaterial color={hair} roughness={0.6} />
            </mesh>
          ))}

          {/* Pirospozsgas orcak */}
          {(face === 'smile' || face === 'grin' || face === 'wink') && [-0.31, 0.31].map((x, i) => (
            <mesh key={'ch' + i} position={[x, -0.1, HR * 0.72]} scale={[1, 0.7, 0.4]}>
              <sphereGeometry args={[0.09, 10, 8]} />
              <meshStandardMaterial color="#ff8aa0" roughness={0.72} transparent opacity={0.7} />
            </mesh>
          ))}

          {/* Szaj */}
          {face === 'openMouth' ? (
            <mesh position={[0, -0.18, HR * 0.78]} scale={[1, 1.3, 0.5]}>
              <sphereGeometry args={[0.1, 14, 12]} />
              <meshStandardMaterial color="#5a1f22" roughness={0.75} />
            </mesh>
          ) : face === 'cool' ? (
            <mesh position={[0, -0.18, HR * 0.84]} rotation={[0, 0, 0.09]}>
              <boxGeometry args={[0.19, 0.032, 0.02]} />
              <meshStandardMaterial color="#7a3b2e" roughness={0.6} />
            </mesh>
          ) : face === 'robot' ? (
            <group position={[0, -0.18, HR * 0.84]}>
              {[-0.07, 0, 0.07].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]}>
                  <boxGeometry args={[0.045, 0.06, 0.02]} />
                  <meshStandardMaterial color="#00eaff" emissive="#0090aa" emissiveIntensity={0.75} />
                </mesh>
              ))}
            </group>
          ) : (
            <group position={[0, -0.14, HR * 0.8]}>
              <mesh rotation={[0.4, 0, Math.PI]}>
                <torusGeometry args={[face === 'grin' ? 0.145 : 0.115, 0.028, 8, 16, Math.PI]} />
                <meshStandardMaterial color="#7a3b2e" roughness={0.6} />
              </mesh>
              {face === 'grin' && (
                <mesh position={[0, -0.05, 0.03]} scale={[1, 0.34, 0.28]}>
                  <boxGeometry args={[0.2, 0.1, 0.06]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.28} />
                </mesh>
              )}
            </group>
          )}

          {/* Szemuvegek */}
          {C.glasses === 'round' && [-0.18, 0.18].map((x, i) => (
            <mesh key={i} position={[x, 0.05, HR * 0.94]}>
              <torusGeometry args={[0.115, 0.017, 8, 18]} />
              <meshStandardMaterial color="#d9a200" metalness={0.6} roughness={0.3} />
            </mesh>
          ))}
          {C.glasses === 'square' && [-0.18, 0.18].map((x, i) => (
            <mesh key={i} position={[x, 0.05, HR * 0.94]}>
              <boxGeometry args={[0.2, 0.15, 0.03]} />
              <meshStandardMaterial color="#101018" roughness={0.4} />
            </mesh>
          ))}
          {C.glasses === 'shades' && (
            <mesh position={[0, 0.06, HR * 0.94]}><boxGeometry args={[0.5, 0.14, 0.05]} /><meshStandardMaterial color="#0a0a12" roughness={0.18} metalness={0.45} /></mesh>
          )}
          {C.glasses === 'gold' && (
            <mesh position={[0, 0.06, HR * 0.94]}><boxGeometry args={[0.5, 0.14, 0.05]} /><meshStandardMaterial color="#f5b91e" metalness={0.85} roughness={0.22} /></mesh>
          )}
          {C.glasses === 'star' && [-0.18, 0.18].map((x, i) => (
            <mesh key={i} position={[x, 0.07, HR * 0.96]} rotation={[0, 0, 0.4]}>
              <boxGeometry args={[0.19, 0.19, 0.03]} />
              <meshStandardMaterial color={i === 0 ? '#ff5dde' : '#00eaff'} roughness={0.28} metalness={0.3} />
            </mesh>
          ))}
          {C.glasses === 'visor' && (
            <mesh position={[0, 0.05, HR * 0.8]} rotation={[0.05, 0, 0]}>
              <boxGeometry args={[0.7, 0.19, 0.12]} />
              <meshStandardMaterial color="#00eaff" emissive="#00b8d4" emissiveIntensity={1} roughness={0.18} />
            </mesh>
          )}

          {/* Frizurak / fejfedok */}
          {C.hat === 'headphones' && (
            <group>
              <mesh position={[0, 0.16, 0]}><torusGeometry args={[HR * 1.0, 0.052, 10, 24, Math.PI]} /><meshStandardMaterial color="#14141c" roughness={0.4} /></mesh>
              {[-1, 1].map((d, i) => (
                <group key={i} position={[d * (HR + 0.02), 0.02, 0]}>
                  <mesh><sphereGeometry args={[0.155, 14, 12]} /><meshStandardMaterial color="#1a1a24" roughness={0.5} /></mesh>
                  <mesh position={[d * 0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.04, 16]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.6} /></mesh>
                </group>
              ))}
            </group>
          )}
          {C.hat === 'mohawk' && [-0.24, -0.08, 0.08, 0.24].map((z, i) => (
            <mesh key={i} position={[0, HR - 0.02 + (0.12 - Math.abs(z) * 0.5), z]} rotation={[z * 1.1, 0, 0]}>
              <coneGeometry args={[0.085, 0.36, 8]} />
              <meshStandardMaterial color={hair} roughness={0.5} />
            </mesh>
          ))}
          {C.hat === 'spikes' && [[-0.26, 0.4, 0.16], [0, 0.5, 0], [0.26, 0.4, 0.16], [-0.16, 0.46, -0.2], [0.16, 0.46, -0.2]].map((p, i) => (
            <mesh key={i} position={p} rotation={[p[2] * 1.4, 0, -p[0] * 1.3]}>
              <coneGeometry args={[0.07, 0.3, 8]} />
              <meshStandardMaterial color={hair} roughness={0.5} />
            </mesh>
          ))}
          {C.hat === 'afro' && (
            <group>
              <mesh position={[0, 0.3, -0.03]}><sphereGeometry args={[0.5, 18, 16]} /><meshStandardMaterial color={hair} roughness={0.9} /></mesh>
              <mesh position={[0, 0.42, 0.28]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color={hair} roughness={0.9} /></mesh>
            </group>
          )}
          {C.hat === 'cap' && (
            <group position={[0, 0.3, 0]} rotation={[0.1, Math.PI, 0]}>
              <mesh><sphereGeometry args={[0.5, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.1]} /><meshStandardMaterial color={accent} roughness={0.55} /></mesh>
              <mesh position={[0, 0.03, 0.5]} rotation={[-0.15, 0, 0]}><boxGeometry args={[0.42, 0.04, 0.32]} /><meshStandardMaterial color={accent} roughness={0.55} /></mesh>
              <mesh position={[0, 0.34, 0]}><sphereGeometry args={[0.045, 8, 8]} /><meshStandardMaterial color="#1a1a24" /></mesh>
            </group>
          )}
          {C.hat === 'flat' && (
            <mesh position={[0, 0.36, 0]} scale={[1, 0.42, 1]}><sphereGeometry args={[0.48, 16, 12]} /><meshStandardMaterial color={hair} roughness={0.82} /></mesh>
          )}
          {C.hat === 'longhair' && (
            <group>
              <mesh position={[0, 0.2, -0.05]} scale={[1.04, 0.85, 1.04]}><sphereGeometry args={[HR, 18, 14, 0, Math.PI * 2, 0, Math.PI / 1.8]} /><meshStandardMaterial color={hair} roughness={0.85} /></mesh>
              {[-1, 1].map((d, i) => (
                <mesh key={i} position={[d * 0.4, -0.2, -0.14]} rotation={[0, 0, -d * 0.18]}>
                  <capsuleGeometry args={[0.105, 0.6, 6, 10]} />
                  <meshStandardMaterial color={hair} roughness={0.85} />
                </mesh>
              ))}
            </group>
          )}
          {C.hat === 'bun' && (
            <group>
              <mesh position={[0, 0.22, -0.02]} scale={[1.03, 0.72, 1.03]}><sphereGeometry args={[HR, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={hair} roughness={0.88} /></mesh>
              <mesh position={[0, 0.6, -0.06]}><sphereGeometry args={[0.18, 14, 12]} /><meshStandardMaterial color={hair} roughness={0.88} /></mesh>
              <mesh position={[0, 0.48, -0.06]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.1, 0.022, 8, 16]} /><meshStandardMaterial color={accent} roughness={0.5} /></mesh>
            </group>
          )}
          {C.hat === 'quiff' && (
            <group>
              <mesh position={[0, 0.24, -0.06]} scale={[1.02, 0.6, 1.02]}><sphereGeometry args={[HR, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={hair} roughness={0.5} /></mesh>
              <mesh position={[0, 0.46, 0.2]} rotation={[0.65, 0, 0]} scale={[1, 0.7, 1.35]}><sphereGeometry args={[0.28, 14, 12]} /><meshStandardMaterial color={hair} roughness={0.5} /></mesh>
            </group>
          )}
          {C.hat === 'dreads' && (
            <group>
              <mesh position={[0, 0.24, -0.02]} scale={[1.03, 0.62, 1.03]}><sphereGeometry args={[HR, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={hair} roughness={0.88} /></mesh>
              {[[-0.36, 0.02, -0.24], [0.36, 0.02, -0.24], [-0.42, -0.04, 0.1], [0.42, -0.04, 0.1], [0, 0.1, -0.44]].map((p, i) => (
                <mesh key={i} position={[p[0], p[1] - 0.16, p[2]]} rotation={[p[2] * 0.5, 0, -p[0] * 0.45]}>
                  <capsuleGeometry args={[0.058, 0.44, 6, 8]} />
                  <meshStandardMaterial color={i % 3 === 0 ? '#c8102e' : i % 3 === 1 ? '#f5b91e' : '#0a6a2f'} roughness={0.72} />
                </mesh>
              ))}
            </group>
          )}
          {C.hat === 'antenna' && (
            <group position={[0, HR, 0]}>
              <mesh><cylinderGeometry args={[0.022, 0.022, 0.26, 8]} /><meshStandardMaterial color="#5b6a85" roughness={0.4} metalness={0.5} /></mesh>
              <mesh position={[0, 0.19, 0]}><sphereGeometry args={[0.072, 10, 8]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.2} /></mesh>
            </group>
          )}
          {C.hat === 'crown' && (
            <group position={[0, HR - 0.04, 0]}>
              <mesh><cylinderGeometry args={[0.28, 0.31, 0.13, 14]} /><meshStandardMaterial color="#f5b91e" metalness={0.85} roughness={0.22} /></mesh>
              {[0, 1, 2, 3, 4].map((i) => {
                const a = (i / 5) * Math.PI * 2;
                return (
                  <group key={i} position={[Math.cos(a) * 0.27, 0.15, Math.sin(a) * 0.27]}>
                    <mesh><coneGeometry args={[0.058, 0.16, 6]} /><meshStandardMaterial color="#f5b91e" metalness={0.85} roughness={0.22} /></mesh>
                    <mesh position={[0, 0.11, 0]}><sphereGeometry args={[0.032, 8, 8]} /><meshStandardMaterial color="#ff2f92" roughness={0.25} /></mesh>
                  </group>
                );
              })}
            </group>
          )}
          {C.extra === 'bow' && (
            <group position={[0.32, 0.4, 0.2]} rotation={[0, 0, -0.4]}>
              {[-0.05, 0.05].map((x, i) => (
                <mesh key={i} position={[x, 0, 0]} scale={[1.3, 0.7, 0.5]}>
                  <sphereGeometry args={[0.075, 8, 8]} />
                  <meshStandardMaterial color="#ff0055" roughness={0.45} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      </group>

      {/* ---- Lebego hangjegyek, amikor szol a zene ---- */}
      {mood === 'win' && (
        <group ref={notes} position={[0, 0.5, 0]}>
          {[0, 1, 2].map((i) => {
            const a = (i / 3) * Math.PI * 2;
            const col = noteColors[i];
            return (
              <group key={i} position={[Math.cos(a) * 1.05, (i % 2) * 0.3, Math.sin(a) * 0.55]} rotation={[0, -a, -0.22]}>
                <mesh><sphereGeometry args={[0.075, 10, 8]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.8} roughness={0.3} /></mesh>
                <mesh position={[0.06, 0.12, 0]}><boxGeometry args={[0.026, 0.24, 0.026]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.65} /></mesh>
                <mesh position={[0.105, 0.215, 0]} rotation={[0, 0, -0.42]}><boxGeometry args={[0.1, 0.05, 0.024]} /><meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.65} /></mesh>
              </group>
            );
          })}
        </group>
      )}
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
        <ambientLight intensity={0.62} />
        <directionalLight position={[4, 6, 4]} intensity={2.3} castShadow={false} />
        <directionalLight position={[-5, 3, -4]} intensity={0.95} color="#7fdcff" />
        {/* szinpadi ellenfeny a figura sajat szineben */}
        <pointLight position={[0, 1.7, -2.6]} intensity={3.2} distance={9} color={c.color} />
        <pointLight position={[0, -1.9, 2.6]} intensity={0.85} distance={8} color="#ff4d8a" />
        <spotLight position={[0, 5.2, 2.2]} angle={0.55} penumbra={0.8} intensity={1.6} color="#ffffff" />
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

const APP_VERSION = 'v35';

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

// BETUVADASZAT: kiszuri a dalokat az elado keresztneve (elso szo) alapjan.
// Ha az elso-szo talalat keves, automatikusan tagul az egesz elado-nevre.
// Ekezet-fuggetlen (a = á = à), es sose "csresel be" ures eredmenynel.
const huntFilter = (list, raw) => {
  const ch = normText(raw || '').charAt(0);
  if (!ch) return { data: list, ch: '', mode: 'off' };
  const firstName = (a) => normText(String(a || '').split(/\s+/)[0]);
  const byFirst = list.filter((s) => firstName(s.a).includes(ch));
  if (byFirst.length >= 24) return { data: byFirst, ch, mode: 'first' };
  const byAny = list.filter((s) => normText(s.a).includes(ch));
  if (byAny.length >= 24) return { data: byAny, ch, mode: 'any' };
  return { data: byAny, ch, mode: 'few' };
};

// ---------- Magyar szamnev -> evszam ----------
// A beszedfelismeres szavakkal ad vissza ("ezerkilencszaznyolcvanketto"),
// ezert a puszta szamjegy-kereses nem eleg.
const HU_NUMS = [
  ['kilencszaz', 900], ['nyolcszaz', 800], ['hetszaz', 700], ['hatszaz', 600],
  ['otszaz', 500], ['negyszaz', 400], ['haromszaz', 300], ['kettoszaz', 200], ['ketszaz', 200],
  ['egyszaz', 100], ['szaz', 100],
  ['kilencven', 90], ['nyolcvan', 80], ['hetven', 70], ['hatvan', 60], ['otven', 50],
  ['negyven', 40], ['harminc', 30], ['huszon', 20], ['husz', 20], ['tizen', 10], ['tiz', 10],
  ['kilenc', 9], ['nyolc', 8], ['het', 7], ['hat', 6], ['ot', 5], ['negy', 4], ['harom', 3],
  ['ketto', 2], ['ket', 2], ['egy', 1],
];
const huChunk = (str) => {
  let total = 0;
  let i = 0;
  let guard = 0;
  while (i < str.length && guard < 60) {
    guard += 1;
    let hit = null;
    for (let k = 0; k < HU_NUMS.length; k++) {
      if (str.startsWith(HU_NUMS[k][0], i)) { hit = HU_NUMS[k]; break; }
    }
    if (hit) { total += hit[1]; i += hit[0].length; }
    else i += 1;
  }
  return total;
};
const parseSpokenYear = (raw) => {
  const txt = String(raw || '');
  // 1) Sima szamjegyek ("1982", "2015")
  const d = txt.match(/\b(1[89]\d{2}|20\d{2})\b/);
  if (d) return parseInt(d[0], 10);
  // 2) Ket kulon szam ("tizenkilenc nyolcvanketto" / "19 82")
  const two = txt.match(/\b(19|20)\s+(\d{2})\b/);
  if (two) return parseInt(two[1] + two[2], 10);
  // 3) Magyar szamnevek
  const s2 = normText(txt).replace(/[^a-z]/g, '');
  if (!s2) return null;
  let year = null;
  const ez = s2.indexOf('ezer');
  if (ez !== -1) {
    const before = s2.slice(0, ez);
    const after = s2.slice(ez + 4);
    const mult = before ? huChunk(before) : 1;
    year = (mult || 1) * 1000 + huChunk(after);
  } else {
    const v = huChunk(s2);
    if (!v) return null;
    if (v < 100) year = 1900 + v;          // "nyolcvanketto" -> 1982
    else if (v < 1000) year = 1000 + v;    // "kilencszaznyolcvanketto" -> 1982
    else year = v;
  }
  if (!year || year < 1900 || year > new Date().getFullYear() + 1) return null;
  return year;
};

// ============================================================
//  SZEMELYRE SZABOTT KATEGORIA-GENERATOR ("alap AI")
//  Statisztikai/heurisztikus elemzes a sajat adatbazisbol.
//  FONTOS: minden generalt csomagnak evtizedeken AT kell nyulnia,
//  kulonben az idovonal-jatek jatszhatatlanna valik.
// ============================================================
const hasWord = (norm, words) => {
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (new RegExp('(^|[^a-z0-9])' + w + '([^a-z0-9]|$)').test(norm)) return true;
  }
  return false;
};

const SMART_RULES = [
  {
    id: 'colors', label: 'SZÍNES CÍMEK', desc: 'Minden dal címében ott egy szín.',
    style: 'linear-gradient(135deg, #FF3D6E 0%, #FFD36A 50%, #00E5FF 100%)',
    test: (t) => hasWord(t, ['red', 'blue', 'blues', 'bluer', 'black', 'blackbird', 'white', 'green', 'gold', 'golden', 'pink', 'purple', 'yellow', 'silver', 'grey', 'gray', 'scarlet', 'crimson', 'amber', 'ivory', 'ebony', 'indigo', 'violet', 'turquoise', 'emerald', 'rainbow', 'neon', 'colour', 'colours', 'color', 'colors', 'blonde', 'brown', 'piros', 'voros', 'kek', 'fekete', 'feher', 'zold', 'arany', 'sarga', 'rozsaszin', 'barna', 'szurke', 'szivarvany', 'szines']),
  },
  {
    id: 'night', label: 'ÉJSZAKAI MŰSZAK', desc: 'Éjjel, hold, sötétség — csupa éjszakai sláger.',
    style: 'linear-gradient(135deg, #1B1B4D 0%, #6A2BFF 55%, #00C8FF 100%)',
    test: (t) => hasWord(t, ['night', 'nights', 'tonight', 'midnight', 'moon', 'moonlight', 'dark', 'darkness', 'star', 'stars', 'dream', 'dreams', 'sleep', 'ej', 'ejjel', 'ejszaka', 'hold', 'sotet', 'csillag', 'alom']),
  },
  {
    id: 'love', label: 'CSUPA SZERELEM', desc: 'Szív, csók, szerelem — a örök téma.',
    style: 'linear-gradient(135deg, #FF0055 0%, #FF5DDE 100%)',
    test: (t) => hasWord(t, ['love', 'loving', 'lover', 'heart', 'hearts', 'kiss', 'kisses', 'baby', 'darling', 'honey', 'romance', 'szerelem', 'szeretlek', 'sziv', 'csok', 'szeret', 'szerelmes']),
  },
  {
    id: 'dance', label: 'TÁNCPARKETT', desc: 'Tánc, buli, mozgás — ezekre nem lehet ülve maradni.',
    style: 'linear-gradient(135deg, #FF6EC7 0%, #FFD700 50%, #00E5FF 100%)',
    test: (t) => hasWord(t, ['dance', 'dancing', 'dancer', 'boogie', 'party', 'groove', 'shake', 'move', 'moving', 'jump', 'rock', 'rocking', 'twist', 'disco', 'tanc', 'tancol', 'buli', 'ropj']),
  },
  {
    id: 'places', label: 'VILÁGKÖRÜLI ÚT', desc: 'Városok és országok a dalcímekben.',
    style: 'linear-gradient(135deg, #00E08A 0%, #00C8FF 55%, #7B2DFF 100%)',
    test: (t) => hasWord(t, ['america', 'american', 'africa', 'african', 'europe', 'paris', 'london', 'york', 'california', 'vienna', 'havana', 'budapest', 'tokyo', 'berlin', 'hollywood', 'memphis', 'chicago', 'georgia', 'alabama', 'jamaica', 'cuba', 'brazil', 'mexico', 'mexican', 'spain', 'spanish', 'italy', 'italian', 'india', 'china', 'japan', 'texas', 'nevada', 'miami', 'detroit', 'liverpool', 'amsterdam', 'ibiza', 'malibu', 'venice', 'roma', 'rome', 'athens', 'moscow', 'egypt', 'nashville', 'orleans', 'vegas', 'boston', 'seattle', 'montana', 'carolina', 'tennessee', 'kentucky', 'virginia', 'arizona', 'colorado', 'ohio', 'kansas', 'dakota', 'oregon', 'hawaii', 'alaska', 'canada', 'england', 'english', 'scotland', 'ireland', 'irish', 'france', 'french', 'germany', 'german', 'holland', 'sweden', 'norway', 'denmark', 'poland', 'russia', 'russian', 'greece', 'turkey', 'israel', 'korea', 'vietnam', 'thailand', 'bali', 'argentina', 'chile', 'peru', 'colombia', 'panama', 'bahamas', 'barbados', 'haiti', 'kingston', 'soho', 'brooklyn', 'bronx', 'harlem', 'manhattan', 'tulsa', 'wichita', 'denver', 'phoenix', 'dallas', 'houston', 'atlanta', 'orlando', 'tampa', 'naples', 'milano', 'madrid', 'barcelona', 'lisbon', 'dublin', 'glasgow', 'manchester', 'brighton', 'oxford', 'copenhagen', 'oslo', 'stockholm', 'prague', 'warsaw', 'istanbul', 'cairo', 'casablanca', 'nairobi', 'sydney', 'melbourne', 'shanghai', 'beijing', 'singapore', 'manila', 'jakarta', 'delhi', 'mumbai', 'island', 'islands', 'city', 'town', 'street', 'avenue', 'beach', 'magyar', 'budapesti', 'balaton', 'pesti', 'varos', 'utca']),
  },
  {
    id: 'weather', label: 'IDŐJÁRÁS-JELENTÉS', desc: 'Eső, napsütés, vihar, évszakok.',
    style: 'linear-gradient(135deg, #4FC3F7 0%, #FFD36A 100%)',
    test: (t) => hasWord(t, ['rain', 'raining', 'rainy', 'sun', 'sunshine', 'sunny', 'storm', 'thunder', 'snow', 'wind', 'winds', 'sky', 'summer', 'winter', 'spring', 'autumn', 'fire', 'cloud', 'clouds', 'eso', 'nap', 'napsutes', 'vihar', 'ho', 'szel', 'nyar', 'tel', 'tavasz', 'osz', 'egbolt']),
  },
  {
    id: 'numbers', label: 'SZÁMOK A CÍMBEN', desc: 'Van bennük egy szám — betűvel vagy számjeggyel.',
    style: 'linear-gradient(135deg, #7B2DFF 0%, #00EAFF 100%)',
    test: (t) => /\d/.test(t) || hasWord(t, ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'million', 'egy', 'ketto', 'harom', 'negy', 'ot', 'hat', 'het', 'nyolc', 'kilenc', 'tiz', 'szaz', 'ezer', 'millio']),
  },
  {
    id: 'road', label: 'ÚTON', desc: 'Autók, vonatok, repülők — mind úton vannak.',
    style: 'linear-gradient(135deg, #FF8A3D 0%, #FF2F6E 100%)',
    test: (t) => hasWord(t, ['road', 'roads', 'highway', 'drive', 'driving', 'car', 'train', 'plane', 'fly', 'flying', 'run', 'running', 'walk', 'walking', 'travel', 'journey', 'ride', 'riding', 'go', 'going', 'away', 'home', 'ut', 'uton', 'auto', 'vonat', 'repulo', 'haza', 'megyek']),
  },
  {
    id: 'alliter', label: 'BETŰRÍM', desc: 'Az előadó és a cím ugyanazzal a betűvel kezdődik.',
    style: 'linear-gradient(135deg, #FFD700 0%, #FF6EC7 100%)',
    test: null,   // kulon logika
  },
  {
    id: 'longtitle', label: 'HOSSZÚ CÍMEK', desc: 'Öt szónál is hosszabb dalcímek.',
    style: 'linear-gradient(135deg, #2E9BFF 0%, #B02BFF 100%)',
    test: null,
  },
];

// Egy jelolt csomag minosegi ellenorzese: eleg dal + evtized-szoras
const smartQuality = (list) => {
  if (list.length < 55) return null;
  const dec = {};
  list.forEach((x) => { const d = Math.floor(x.y / 10) * 10; dec[d] = (dec[d] || 0) + 1; });
  const keys = Object.keys(dec).map(Number).sort((a, b) => a - b);
  if (keys.length < 4) return null;                       // legalabb 4 evtized
  const span = keys[keys.length - 1] - keys[0];
  if (span < 30) return null;                             // legalabb 30 ev atfogas
  const top = Math.max(...keys.map((k) => dec[k]));
  if (top / list.length > 0.55) return null;              // ne zsufolodjon egy evtizedbe
  return { span, decades: keys.length };
};

const buildSmartPacks = (allSongs, profile, seed) => {
  const out = [];
  const src = allSongs || [];
  if (src.length < 200) return out;

  // --- 1) Mintazat-alapu csomagok ---
  SMART_RULES.forEach((rule) => {
    let list;
    if (rule.id === 'alliter') {
      list = src.filter((x) => {
        const a = normText(x.a).replace(/^(the|a|az) /, '').charAt(0);
        const t = normText(x.t).replace(/^(the|a|az) /, '').charAt(0);
        return a && t && a === t;
      });
    } else if (rule.id === 'longtitle') {
      list = src.filter((x) => String(x.t).trim().split(/\s+/).length >= 5);
    } else {
      list = src.filter((x) => rule.test(normText(x.t)));
    }
    const q = smartQuality(list);
    if (q) out.push({ key: 'smart:' + rule.id, label: rule.label, desc: rule.desc, style: rule.style, data: list, meta: `${q.decades} évtizedből` });
  });

  // --- 2) Szemelyre szabott: a leggyengebb evtized gyakorlasa ---
  const P = profile || {};
  const dec = P.decades || {};
  const tried = Object.keys(dec).map(Number).filter((d) => dec[d] && dec[d].a >= 6);
  if (tried.length >= 2) {
    let worst = null;
    let worstRate = 2;
    tried.forEach((d) => {
      const r = dec[d].h / Math.max(1, dec[d].a);
      if (r < worstRate) { worstRate = r; worst = d; }
    });
    if (worst !== null && worstRate < 0.75) {
      // A gyenge evtized + a ket szomszedja (hogy legyen mihez viszonyitani)
      const list = src.filter((x) => x.y >= worst - 10 && x.y < worst + 20);
      if (list.length >= 55) {
        out.push({
          key: 'smart:weak',
          label: `GYAKORLÓ: ${worst}-ES ÉVEK`,
          desc: `Itt hibázol a legtöbbet (${Math.round(worstRate * 100)}% találat). A szomszéd évtizedekkel együtt.`,
          style: 'linear-gradient(135deg, #FF2F6E 0%, #FFD36A 100%)',
          data: list,
          meta: 'a te statisztikád alapján',
          personal: true,
        });
      }
    }
    // --- 3) A legerosebb evtized: "hazai palya" ---
    let best = null;
    let bestRate = -1;
    tried.forEach((d) => {
      const r = dec[d].h / Math.max(1, dec[d].a);
      if (r > bestRate) { bestRate = r; best = d; }
    });
    if (best !== null && bestRate >= 0.7 && best !== worst) {
      const list = src.filter((x) => x.y >= best - 15 && x.y < best + 25);
      if (list.length >= 55) {
        out.push({
          key: 'smart:strong',
          label: `HAZAI PÁLYA: ${best}-AS ÉVEK`,
          desc: `Ebben vagy a legjobb (${Math.round(bestRate * 100)}% találat). Villogj vele!`,
          style: 'linear-gradient(135deg, #00E08A 0%, #00C8FF 100%)',
          data: list,
          meta: 'a te statisztikád alapján',
          personal: true,
        });
      }
    }
  }

  // --- 4) Napi forgatas: a mintazat-csomagokbol naponta mas 4 kerul elore ---
  const personal = out.filter((p) => p.personal);
  const pattern = out.filter((p) => !p.personal);
  let h = seed || 0;
  const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  for (let i = pattern.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = pattern[i]; pattern[i] = pattern[j]; pattern[j] = tmp;
  }
  return [...personal, ...pattern.slice(0, 4)];
};

const isIOSDevice = typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
   (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const shuffleDeck = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Egy CSS-gradiens szovegbol kiszedi a ket szelso szint (SVG-hez)
const packColors = (styleStr) => {
  const m = String(styleStr || '').match(/#[0-9a-fA-F]{3,8}/g) || [];
  return [m[0] || '#ff0055', m[m.length - 1] || '#00eaff'];
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


// ---------- Egyedi menu-ikonok (nem lucide, sajat SVG) ----------
const IcoVinyl = () => (
  <svg viewBox="0 0 48 48" width="44" height="44" fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="21" fill="#0c0a16" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <circle cx="24" cy="24" r="9.5" fill="currentColor" opacity="0.9" />
    <circle cx="24" cy="24" r="2.4" fill="#0c0a16" />
    <path d="M21 18.5v11l9-5.5z" fill="#0c0a16" />
  </svg>
);
const IcoDaily = () => (
  <svg viewBox="0 0 48 48" width="42" height="42" fill="none" aria-hidden="true">
    <rect x="7" y="9" width="34" height="32" rx="5" stroke="currentColor" strokeWidth="2.5" />
    <path d="M7 17h34" stroke="currentColor" strokeWidth="2.5" />
    <path d="M15 5v7M33 5v7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M24 21l2.3 4.6 5.1.7-3.7 3.6.9 5.1L24 32.6l-4.5 2.4.9-5.1-3.7-3.6 5.1-.7z" fill="currentColor" />
  </svg>
);
const IcoBot = () => (
  <svg viewBox="0 0 48 48" width="42" height="42" fill="none" aria-hidden="true">
    <rect x="9" y="15" width="30" height="24" rx="7" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="18" cy="27" r="3.4" fill="currentColor" />
    <circle cx="30" cy="27" r="3.4" fill="currentColor" />
    <path d="M19 33.5h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M24 8v7M24 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="7" r="2.6" fill="currentColor" />
    <path d="M5 24v6M43 24v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
const IcoPhone = () => (
  <svg viewBox="0 0 48 48" width="42" height="42" fill="none" aria-hidden="true">
    <rect x="14" y="5" width="20" height="38" rx="5" stroke="currentColor" strokeWidth="2.5" />
    <path d="M21 38h6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M20 14h8M20 19h8M20 24h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
  </svg>
);
const IcoTrophy = () => (
  <svg viewBox="0 0 48 48" width="42" height="42" fill="none" aria-hidden="true">
    <path d="M15 8h18v9a9 9 0 01-18 0z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M15 11H9v3a6 6 0 006 6M33 11h6v3a6 6 0 01-6 6" stroke="currentColor" strokeWidth="2.5" />
    <path d="M24 26v7M18 40h12M20 40l1-7h6l1 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IcoPack = () => (
  <svg viewBox="0 0 48 48" width="42" height="42" fill="none" aria-hidden="true">
    <rect x="16" y="12" width="20" height="28" rx="3.5" stroke="currentColor" strokeWidth="2.5" transform="rotate(9 26 26)" />
    <rect x="10" y="9" width="20" height="28" rx="3.5" fill="#0c0a16" stroke="currentColor" strokeWidth="2.5" />
    <path d="M20 20l3 3-3 3M17 26h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
  </svg>
);
const IcoModes = () => (
  <svg viewBox="0 0 48 48" width="42" height="42" fill="none" aria-hidden="true">
    <path d="M10 15h28M10 24h28M10 33h28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
    <circle cx="18" cy="15" r="4" fill="#0c0a16" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="31" cy="24" r="4" fill="#0c0a16" stroke="currentColor" strokeWidth="2.5" />
    <circle cx="20" cy="33" r="4" fill="#0c0a16" stroke="currentColor" strokeWidth="2.5" />
  </svg>
);

// ============================================================
//  CHRONOBEATS LOGO - bakelit-jelveny (B valtozat)
// ============================================================
function ChronoLogo() {
  return (
    <svg className="cb-svg" viewBox="0 0 220 220" role="img" aria-label="ChronoBeats">
      <defs>
        <path id="cbTop" d="M26,110 A84,84 0 0,0 194,110" fill="none" />
        <path id="cbBot" d="M28,110 A82,82 0 0,1 192,110" fill="none" />
      </defs>
      {/* forgo lemez */}
      <g className="cb-disc">
        <circle cx="110" cy="110" r="72" fill="#0d0a14" stroke="#2a2740" strokeWidth="1.5" />
        <circle cx="110" cy="110" r="60" fill="none" stroke="#22203a" strokeWidth="1" />
        <circle cx="110" cy="110" r="48" fill="none" stroke="#22203a" strokeWidth="1" />
        <circle cx="110" cy="110" r="30" fill="#ff1f6e" />
        {/* hangjegy a cimken */}
        <path d="M101,124 L101,98 L121,94 L121,120" fill="none" stroke="#0a0618" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="98" cy="124" r="4.6" fill="#0a0618" />
        <circle cx="118" cy="120" r="4.6" fill="#0a0618" />
      </g>
      {/* ivelt felirat (all) */}
      <text className="cb-top" fontFamily="Montserrat, Arial Black, Arial" fontSize="17" fontWeight="900" letterSpacing="3">
        <textPath href="#cbTop" startOffset="50%" textAnchor="middle">CHRONO</textPath>
      </text>
      <text className="cb-bot" fontFamily="Montserrat, Arial Black, Arial" fontSize="17" fontWeight="900" letterSpacing="3">
        <textPath href="#cbBot" startOffset="50%" textAnchor="middle">BEATS</textPath>
      </text>
      {/* lejatszo-kar (all) */}
      <line x1="182" y1="52" x2="132" y2="96" stroke="#00eaff" strokeWidth="5" strokeLinecap="round" />
      <circle cx="184" cy="50" r="6" fill="#00eaff" />
      <circle cx="130" cy="98" r="4" fill="#00eaff" />
    </svg>
  );
}

// ============================================================
//  MENU COVERFLOW - 3D lapozhato menukartyak (nincs WebGL, csak CSS-transzform)
// ============================================================
function MenuCarousel({ items, active, setActive, onSelect }) {
  const stageRef = useRef(null);
  const [w, setW] = useState(340);
  const [drag, setDrag] = useState(0);
  const S = useRef({ down: false, x0: 0, y0: 0, dx: 0, moved: false, dir: 0 });
  const rafRef = useRef(0);
  const pendRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;
  const spacingRef = useRef(200);

  const n = items.length;
  const clamp = (i) => Math.max(0, Math.min(n - 1, i));
  spacingRef.current = Math.min(w * 0.5, 200);

  useEffect(() => {
    const measure = () => { if (stageRef.current) setW(stageRef.current.clientWidth); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Natv touch + eger huzas (megbizhatobb mobilon, mint a szintetikus pointer)
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const s = S.current;
    const onDown = (e) => {
      const p = e.touches ? e.touches[0] : e;
      s.down = true; s.x0 = p.clientX; s.y0 = p.clientY; s.dx = 0; s.moved = false; s.dir = 0;
    };
    const onMove = (e) => {
      if (!s.down) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - s.x0;
      const dy = p.clientY - s.y0;
      if (s.dir === 0 && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.dir = Math.abs(dx) > Math.abs(dy) ? 1 : -1;
      if (s.dir === 1) {
        if (e.cancelable) e.preventDefault();
        s.moved = true; s.dx = dx; pendRef.current = dx;
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => { rafRef.current = 0; setDrag(pendRef.current); });
        }
      }
    };
    const onUp = () => {
      if (!s.down) return;
      s.down = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      const th = spacingRef.current * 0.28;
      if (s.dx > th) setActive(clamp(activeRef.current - 1));
      else if (s.dx < -th) setActive(clamp(activeRef.current + 1));
      s.dx = 0; setDrag(0);
    };
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onUp);
    el.addEventListener('touchcancel', onUp);
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onUp);
      el.removeEventListener('touchcancel', onUp);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  const spacing = spacingRef.current;
  const shift = drag / (spacing || 1);

  return (
    <div className="cf-stage" ref={stageRef}>
      <div className="cf-track">
        {items.map((it, i) => {
          const off = i - active + shift;
          const abs = Math.abs(off);
          const hidden = abs > 2.4;
          const style = {
            transform: `translate(-50%, -50%) translateX(${off * spacing}px) translateZ(${-abs * 130}px) rotateY(${off * -34}deg) scale(${Math.max(0.62, 1 - abs * 0.08)})`,
            opacity: hidden ? 0 : Math.max(0, 1 - abs * 0.26),
            zIndex: 100 - Math.round(abs * 10),
            pointerEvents: hidden ? 'none' : 'auto',
            transition: S.current.down ? 'none' : 'transform .45s cubic-bezier(.2,.8,.2,1), opacity .45s',
          };
          const isCenter = i === active;
          return (
            <button
              key={it.key}
              type="button"
              className={`cf-card ${it.cls} ${isCenter ? 'center' : ''}`}
              style={style}
              onClick={() => {
                if (S.current.moved) return;
                if (i === active) onSelect(it.key);
                else setActive(i);
              }}
            >
              <span className="cf-run" />
              <span className="cf-sheen" />
              <span className="cf-ico">{it.icon}</span>
              <span className="cf-title">{it.title}</span>
              {it.meta && <span className="cf-meta">{it.meta}</span>}
              <span className="cf-go">{isCenter ? (it.cta || 'VÁLASZT') : ''}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="cf-arrow left" aria-label="Előző" onClick={() => setActive(clamp(active - 1))}>‹</button>
      <button type="button" className="cf-arrow right" aria-label="Következő" onClick={() => setActive(clamp(active + 1))}>›</button>
      <div className="cf-dots">
        {items.map((it, i) => (
          <span key={it.key} className={`cf-dot ${i === active ? 'on' : ''}`} />
        ))}
      </div>
    </div>
  );
}

const Backdrop = React.memo(function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="sky" />
      <div className="stars" />
      <div className="beam b1" />
      <div className="beam b2" />
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
  // ---------- APPLE MUSIC (MusicKit JS) - opcionalis teljes lejatszas ----------
  const [appleOn, setAppleOn] = useState(() => { try { return localStorage.getItem('cb_apple_on') === '1'; } catch (e) { return false; } });
  const [appleToken, setAppleToken] = useState(() => { try { return localStorage.getItem('cb_apple_token') || ''; } catch (e) { return ''; } });
  const [appleState, setAppleState] = useState('off');   // off | loading | ready | authed | error
  const [appleTrack, setAppleTrack] = useState(null);    // az aktualis dal Apple-azonositoja
  const appleRef = useRef(null);
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
  const [micStep, setMicStep] = useState(0);        // 0=evszam, 1=eloado, 2=cim, 3=kesz
  // ---------- HANGCSATORNA (WebRTC a meglevo PeerJS-en) ----------
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voicePeers, setVoicePeers] = useState([]);       // akikkel el a hangkapcsolat
  const [voiceDuck, setVoiceDuck] = useState(() => { try { return localStorage.getItem('cb_voice_duck') !== '0'; } catch (e) { return true; } });
  const voiceOnRef = useRef(false);
  const localStreamRef = useRef(null);
  const callsRef = useRef({});      // peerId -> MediaConnection
  const audioElsRef = useRef({});   // peerId -> <audio>
  const myPeerIdRef2 = useRef('');
  const [smartSeed, setSmartSeed] = useState(() => {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  });
  const micStepRef = useRef(0);
  const [betData, setBetData] = useState({ year: '', artist: '', title: '' });
  const [betResult, setBetResult] = useState(null);

  const [newName, setNewName] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [menuIndex, setMenuIndex] = useState(0);
  const [infoMode, setInfoMode] = useState(null);   // jatekmod reszletes leiras
  const [installEvt, setInstallEvt] = useState(null);   // Android: elmentett telepito-esemeny
  const [showInstall, setShowInstall] = useState(false);
  const [iosInstall, setIosInstall] = useState(false);  // iPhone: kezi utmutato kell
  const [letterHunt, setLetterHunt] = useState('');   // BETUVADASZAT: eloado keresztnevenek kezdo szurobetuje
  const [selectedPack, setSelectedPack] = useState('mix');
  const [showPackSelection, setShowPackSelection] = useState(false);
  const [toast, setToast] = useState(null);

  // ---------- Jatekmodok es extra funkciok ----------
  const [modes, setModes] = useState(() => {
    try { return { blind: false, speed: false, gold: false, reverse: false, veto: false, pranks: false, steal: false, ...(JSON.parse(localStorage.getItem('cb_modes') || '{}')) }; }
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
    const modeNames = [activeModes.blind && 'BLIND', activeModes.speed && 'SPEED RUN', activeModes.gold && 'ARANY KÁRTYA', activeModes.reverse && 'REVERSE', activeModes.veto && 'ÓVÁS', activeModes.pranks && 'ZAVARÁS'].filter(Boolean);
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

  // ---------- ONSZABALYOZO LATVANY (adaptiv FX-koltsegvetes) ----------
  // Kezdetben minden animacio megy. Ha esik az FPS, NEM kapcsol le mindent,
  // hanem korbeforgatva random kevesebb effektet tart egyszerre aktivan,
  // igy marad "elet" a kepernyon, de a terheles a plafon alatt marad.
  useEffect(() => {
    // Lite modban / csokkentett mozgasnal a meglevo szabalyok intezik -> nem futtatjuk
    if (liteActive || REDUCED_MOTION) {
      document.body.classList.remove('nofx-beams', 'nofx-stars', 'nofx-grid', 'nofx-bob', 'nofx-sheen', 'nofx-notes', 'nofx-glass');
      return undefined;
    }
    const POOL = ['beams', 'stars', 'grid', 'bob', 'sheen', 'notes']; // korbeforgathato effektek
    let budget = POOL.length;   // hany effekt lehet EGYSZERRE aktiv (kezdetben mind)
    let glassCut = false;       // vegso vedvonal: az uveg-elmosas is lekapcsol
    let selection = [...POOL];  // eppen aktiv effektek
    let tick = 0;

    const shuffle = (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    };
    const apply = () => {
      const off = POOL.filter((e) => !selection.includes(e));
      POOL.forEach((e) => document.body.classList.toggle('nofx-' + e, off.includes(e)));
      document.body.classList.toggle('nofx-glass', glassCut);
    };

    // FPS-mero: masodpercenkent atlag
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t) => {
      frames += 1;
      if (t - last >= 1000) {
        const fps = (frames * 1000) / (t - last);
        frames = 0; last = t;
        // koltsegvetes-igazitas hiszterezissel
        if (fps < 50 && budget > 0) budget -= 1;
        else if (fps > 56 && budget < POOL.length) budget += 1;
        if (budget === 0 && fps < 44) glassCut = true;
        else if (fps > 57) glassCut = false;
        tick += 1;
        // ~4 mp-enkent (vagy ha valtozott a keret) ujra sorsolunk: MAS effektek maradnak
        if (selection.length !== budget || tick % 4 === 0) {
          selection = shuffle(POOL).slice(0, budget);
          apply();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove('nofx-beams', 'nofx-stars', 'nofx-grid', 'nofx-bob', 'nofx-sheen', 'nofx-notes', 'nofx-glass');
    };
  }, [liteActive]);

  // ---------- APPLE MUSIC: MusicKit betoltese ----------
  // A fejlesztoi token (JWT) a sajat Apple Developer fiokodbol jon - a beallitasokban adod meg.
  useEffect(() => {
    if (!appleOn || !appleToken.trim()) { setAppleState('off'); return undefined; }
    let cancelled = false;
    const boot = async () => {
      try {
        setAppleState('loading');
        if (!window.MusicKit) {
          await new Promise((res, rej) => {
            const ex = document.getElementById('musickit-js');
            if (ex) { ex.addEventListener('load', res); ex.addEventListener('error', rej); return; }
            const sc = document.createElement('script');
            sc.id = 'musickit-js';
            sc.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
            sc.async = true;
            sc.onload = res;
            sc.onerror = rej;
            document.head.appendChild(sc);
          });
          if (!window.MusicKit) {
            await new Promise((res) => {
              document.addEventListener('musickitloaded', res, { once: true });
              setTimeout(res, 5000);
            });
          }
        }
        if (cancelled) return;
        if (!window.MusicKit) throw new Error('MusicKit nem toltodott be');
        const mk = await window.MusicKit.configure({
          developerToken: appleToken.trim(),
          app: { name: 'ChronoBeats', build: APP_VERSION },
        });
        if (cancelled) return;
        appleRef.current = mk || window.MusicKit.getInstance();
        setAppleState(appleRef.current && appleRef.current.isAuthorized ? 'authed' : 'ready');
      } catch (e) {
        if (!cancelled) setAppleState('error');
      }
    };
    boot();
    return () => { cancelled = true; };
  }, [appleOn, appleToken]);

  const appleConnect = async () => {
    const mk = appleRef.current;
    if (!mk) { showToast('Előbb add meg a fejlesztői tokent!'); return; }
    try {
      await mk.authorize();
      setAppleState('authed');
      showToast('Apple Music csatlakoztatva — mostantól teljes dalok szólnak!');
    } catch (e) {
      showToast('A csatlakozás megszakadt.');
    }
  };
  const appleDisconnect = async () => {
    try { if (appleRef.current) await appleRef.current.unauthorize(); } catch (e) {}
    setAppleTrack(null);
    setAppleState('ready');
    showToast('Apple Music lecsatlakoztatva — marad a rövid részlet.');
  };

  // Az aktualis dal megkeresese az Apple katalogusban
  const appleFind = async (card) => {
    const mk = appleRef.current;
    if (!mk || !card) return null;
    try {
      const sf = mk.storefrontId || 'hu';
      const r = await mk.api.music(`/v1/catalog/${sf}/search`, {
        term: `${card.a} ${card.t}`, types: 'songs', limit: 5,
      });
      const songs = r && r.data && r.data.results && r.data.results.songs;
      const list = songs && songs.data ? songs.data : [];
      if (!list.length) return null;
      const key = normText(String(card.a).split(/\s+/)[0]);
      const hit = list.find((x) => normText((x.attributes || {}).artistName || '').includes(key));
      return (hit || list[0]).id;
    } catch (e) { return null; }
  };

  // Uj kartyanal megkeressuk az Apple-valtozatot
  useEffect(() => {
    setAppleTrack(null);
    if (appleState !== 'authed' || !currentCard) return undefined;
    let cancel = false;
    appleFind(currentCard).then((id) => { if (!cancel) setAppleTrack(id); });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard, appleState]);

  // ---------- TELEPITES A KEZDOKEPERNYORE ----------
  // Androidon a bongeszo valodi telepito-ablakot tud nyitni (beforeinstallprompt).
  // iPhone-on ilyen nincs, ott vizualis utmutatot mutatunk a Megosztas gombhoz.
  useEffect(() => {
    // Mar telepitve van? Akkor semmit nem mutatunk.
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
    if (standalone) return undefined;

    // Korabban elutasitotta? 14 napig nem nyaggatjuk.
    try {
      const t = parseInt(localStorage.getItem('cb_install_off') || '0', 10);
      if (t && Date.now() - t < 14 * 24 * 60 * 60 * 1000) return undefined;
    } catch (e) {}

    const ua = window.navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvt(e);
      setTimeout(() => setShowInstall(true), 2500);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    let t2 = null;
    if (isIOS) {
      setIosInstall(true);
      t2 = setTimeout(() => setShowInstall(true), 3500);
    }
    const onInstalled = () => { setShowInstall(false); setInstallEvt(null); };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (t2) clearTimeout(t2);
    };
  }, []);

  const dismissInstall = () => {
    setShowInstall(false);
    try { localStorage.setItem('cb_install_off', String(Date.now())); } catch (e) {}
  };
  const doInstall = async () => {
    if (!installEvt) return;
    try {
      installEvt.prompt();
      const res = await installEvt.userChoice;
      if (res && res.outcome === 'accepted') showToast('Készen van — keresd az ikont a kezdőképernyőn!');
      else try { localStorage.setItem('cb_install_off', String(Date.now())); } catch (e) {}
    } catch (e) {}
    setInstallEvt(null);
    setShowInstall(false);
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
    try { if (appleRef.current && appleRef.current.isPlaying) appleRef.current.pause(); } catch (e) {}
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

  // Generalt ("okos") csomagok - naponta frissul, a profil alapjan szemelyre szabva
  const smartPacks = useMemo(
    () => buildSmartPacks(SONG_PACKS.mix.data, loadProfile(), smartSeed),
    [smartSeed]
  );
  const getPack = (key) => {
    if (key && String(key).startsWith('smart:')) {
      return smartPacks.find((p) => p.key === key) || SONG_PACKS.mix;
    }
    return SONG_PACKS[key] || SONG_PACKS.mix;
  };

  const beginMatch = (roster) => {
    dailyRef.current = null;
    botRef.current = roster.some((p) => p.isBot) ? botRef.current : null;
    statRef.current = { correct: 0, wrong: 0 };
    endDoneRef.current = false;
    const pack = getPack(selectedPack);
    if (!pack || !pack.data || pack.data.length === 0) {
      showToast('Hiba: a választott csomag üres. Válassz másikat!');
      return;
    }
    // BETUVADASZAT szuro (ha be van allitva)
    let poolData = pack.data;
    if (letterHunt.trim()) {
      const need = WIN_CARDS + roster.length + 4; // legyen elég lap egy meccsre
      const res = huntFilter(pack.data, letterHunt);
      if (!res.ch) {
        // ervenytelen betu -> figyelmen kivul hagyjuk
      } else if (res.data.length < need) {
        showToast(`Csak ${res.data.length} dal van a(z) „${res.ch.toUpperCase()}” betűvel — próbálj gyakoribbat (pl. A, E, S)!`);
        return;
      } else {
        poolData = res.data;
        if (res.mode === 'any') showToast(`Betűvadászat: kevés keresztnév, így minden „${res.ch.toUpperCase()}”-t tartalmazó előadó jön! (${poolData.length} dal)`);
        else showToast(`Betűvadászat: csak „${res.ch.toUpperCase()}” keresztnevű előadók! (${poolData.length} dal)`);
      }
    }
    if (audioRef.current) {
      audioRef.current.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAGZGF0YQQAAAAAAA==';
      audioRef.current.play().then(() => audioRef.current.pause()).catch(() => {});
    }
    const shuffled = shuffleDeck([...poolData]);
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

  // Apple Music csak akkor veszi at, ha van talalat es nem Reverse mod fut
  const appleActive = appleState === 'authed' && !!appleTrack && !activeModes.reverse;

  const toggleApple = async () => {
    const mk = appleRef.current;
    if (!mk) return;
    try {
      if (isPlaying) {
        await mk.pause();
        setIsPlaying(false);
      } else {
        await mk.setQueue({ song: appleTrack, startPlaying: true });
        setIsPlaying(true);
      }
    } catch (e) {
      showToast('Apple Music nem indult — a rövid részlet jön.');
      if (audioRef.current && audioUrl) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const toggleMusic = () => {
    if (appleActive) { toggleApple(); return; }
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
    const isAudioBroken = !audioUrl && !isLoading && !appleActive;
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
      if (prankPlus) showToast('Pontos évszám — +1 zavarás-token!');
      setPlayers(players.map((p, i) => (i === turnIndex ? { ...p, tokens: p.tokens + earned, pranks: (p.pranks || 0) + prankPlus } : p)));
      setBetResult({ total: earned, exactYear: ys === 2 });
    } else {
      setBetResult({ total: 0 });
    }
    setBetData({ year: '', artist: '', title: '' });
    setTimeout(() => setBetResult(null), 2600);
  };

  const nextTurn = (repeat = false) => {
    setFlipped(false);
    setFeedback(null);
    setWrongIndex(null);
    setBetResult(null);
    pauseMusic();
    const c = drawNext();
    if (!c) { finishByDeck(); return; }
    if (!repeat) setTurnIndex((i) => {
      let ni = (i + 1) % players.length;
      let guard = 0;
      while (players[ni] && skipNextRef.current[players[ni].id] && guard < players.length) {
        delete skipNextRef.current[players[ni].id];
        const nm = players[ni].name;
        setTimeout(() => showToast(`⏭️ ${nm} kimarad ebből a körből (jogos óvás).`), 60);
        ni = (ni + 1) % players.length;
        guard += 1;
      }
      return ni;
    });
    turnCountRef.current += 1;
    const gold = activeModes.gold && Math.random() < 0.2;
    setGoldCard(gold);
    if (gold) { sfx.gold(); haptics.gold(); showToast('ARANY KÁRTYA! Ha eltalálod a helyét, MÉGEGYSZER te jössz!'); }
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
      const goldAgain = goldCard;   // arany kartya eltalalva -> ujra o kovetkezik
      const newTL = [...tl];
      newTL.splice(index, 0, currentCard);
      const updated = players.map((p, i) => (i === turnIndex ? { ...p, timeline: newTL } : p));
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
          if (goldAgain) showToast('✨ ARANY KÁRTYA ELTALÁLVA — újra te következel!');
          nextTurn(goldAgain);
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
      showToast(`⚖️ JOGOS ÓVÁS! ${placer.name} kimarad a következő körből, ${vetoer.name}: +1 🪙`);
      setPlayers((prev) => prev.map((p, i) => (i === vetoerIdx ? { ...p, tokens: (p.tokens || 0) + 1 } : p)));
    } else {
      showToast(`🛡️ A lerakás JÓ volt — az óvás alaptalan. ${vetoer.name}: -1 🪙, ${placer.name}: +1 🪙`);
      setPlayers((prev) => prev.map((p, i) => {
        if (i === vetoerIdx) return { ...p, tokens: Math.max(0, (p.tokens || 0) - 1) };
        if (i === turnIndex) return { ...p, tokens: (p.tokens || 0) + 1 };
        return p;
      }));
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
    peer.on('open', (pid) => {
      myPeerIdRef2.current = pid || `cbeats-${code}`;
      setRoomCode(code);
      setNetRole('host');
      setNetBusy(false);
      showToast(`📡 Szoba kész! Kód: ${code}`);
    });
    peer.on('call', (call) => {
      if (!voiceOnRef.current || !localStreamRef.current) { try { call.close(); } catch (e) {} return; }
      try {
        call.answer(localStreamRef.current);
        callsRef.current[call.peer] = call;
        call.on('stream', (rs) => attachRemote(call.peer, rs));
        call.on('close', () => dropRemote(call.peer));
        call.on('error', () => dropRemote(call.peer));
      } catch (e) {}
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
    peer.on('call', (call) => {
      if (!voiceOnRef.current || !localStreamRef.current) { try { call.close(); } catch (e) {} return; }
      try {
        call.answer(localStreamRef.current);
        callsRef.current[call.peer] = call;
        call.on('stream', (rs) => attachRemote(call.peer, rs));
        call.on('close', () => dropRemote(call.peer));
        call.on('error', () => dropRemote(call.peer));
      } catch (e) {}
    });
    peer.on('open', (pid) => {
      setMyPeerId(pid);
      myPeerIdRef.current = pid;
      myPeerIdRef2.current = pid;
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

  const ShameView = null;   // (a szegyenfal-mechanika megszunt)

  // Jatekmod reszletes leirasa (felugro ablak)
  const ModeInfoView = (
    <AnimatePresence>
      {infoMode && (
        <div className="modal-overlay info-overlay" onClick={() => setInfoMode(null)}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="modal-box glass info-modal"
            initial={{ scale: 0.88, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 20 }}
          >
            <button type="button" className="close-modal" onClick={() => setInfoMode(null)}><X size={22} /></button>
            <div className="im-head">
              <span className="im-ico">{infoMode.icon}</span>
              <div className="im-titles">
                <span className="im-name">{infoMode.name}</span>
                {infoMode.online && <span className="im-tag">CSAK ONLINE SZOBÁBAN</span>}
              </div>
            </div>
            <div className="im-body">
              {String(infoMode.long || '').split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
            </div>
            <button type="button" className="im-ok" onClick={() => setInfoMode(null)}>ÉRTEM</button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Telepitesi ajanlat - also lap (Android: valodi gomb, iPhone: utmutato)
  const InstallView = (
    <AnimatePresence>
      {showInstall && status === 'menu' && (
        <motion.div
          className="inst-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismissInstall}
        >
          <motion.div
            className="inst-sheet"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <span className="inst-grab" />
            <button type="button" className="inst-x" onClick={dismissInstall} aria-label="Bezárás"><X size={18} /></button>

            <div className="inst-top">
              <span className="inst-badge"><ChronoLogo /></span>
              <div className="inst-heads">
                <span className="inst-title">Tedd ki a kezdőképernyőre</span>
                <span className="inst-sub">Úgy indul, mint egy rendes alkalmazás — böngésző nélkül.</span>
              </div>
            </div>

            <div className="inst-perks">
              <span className="inst-perk"><b>Teljes képernyő</b>címsor nélkül</span>
              <span className="inst-perk"><b>Egy koppintás</b>saját ikonról</span>
              <span className="inst-perk"><b>Net nélkül is</b>elindul</span>
            </div>

            {iosInstall ? (
              <div className="inst-steps">
                <div className="inst-step">
                  <span className="is-num">1</span>
                  <span className="is-txt">Koppints alul a <b>Megosztás</b> gombra</span>
                  <span className="is-ico"><Share size={19} /></span>
                </div>
                <div className="inst-step">
                  <span className="is-num">2</span>
                  <span className="is-txt">Görgess le, és válaszd: <b>Hozzáadás a kezdőképernyőhöz</b></span>
                  <span className="is-ico"><Smartphone size={19} /></span>
                </div>
                <button type="button" className="inst-ghost" onClick={dismissInstall}>Rendben, megcsinálom</button>
              </div>
            ) : (
              <div className="inst-actions">
                <button type="button" className="inst-go" onClick={doInstall}>
                  <Download size={18} /> TELEPÍTÉS
                </button>
                <button type="button" className="inst-ghost" onClick={dismissInstall}>Most nem</button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const sendAction = (a, extra = {}) => {
    try { if (hostConnRef.current && hostConnRef.current.open) hostConnRef.current.send({ type: 'action', a, ...extra }); } catch (e) {}
  };

  const leaveRoom = () => {
    try { peerRef.current && peerRef.current.destroy(); } catch (e) {}
    voiceOnRef.current = false;
    Object.keys(audioElsRef.current).forEach((pid) => {
      const el = audioElsRef.current[pid];
      if (el) { try { el.srcObject = null; el.remove(); } catch (e) {} }
    });
    audioElsRef.current = {};
    Object.keys(callsRef.current).forEach((pid) => { try { callsRef.current[pid].close(); } catch (e) {} });
    callsRef.current = {};
    if (localStreamRef.current) { try { localStreamRef.current.getTracks().forEach((t) => t.stop()); } catch (e) {} }
    localStreamRef.current = null;
    setVoiceOn(false); setVoicePeers([]); setVoiceMuted(false);
    peerRef.current = null; connsRef.current = {}; hostConnRef.current = null;
    setNetRole(null); setRoomCode(''); setSnap(null);
    setStatus('setup');
  };

  // ============================================================
  //  HANGCSATORNA - a jatekosok beszelhetnek egymassal
  //  A meglevo PeerJS kapcsolatot hasznalja (WebRTC), nincs uj szerver.
  // ============================================================
  const attachRemote = (peerId, stream) => {
    let el = audioElsRef.current[peerId];
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      el.playsInline = true;
      el.setAttribute('playsinline', 'true');
      audioElsRef.current[peerId] = el;
      document.body.appendChild(el);
    }
    el.srcObject = stream;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    setVoicePeers((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]));
  };

  const dropRemote = (peerId) => {
    const el = audioElsRef.current[peerId];
    if (el) { try { el.srcObject = null; el.remove(); } catch (e) {} delete audioElsRef.current[peerId]; }
    const c = callsRef.current[peerId];
    if (c) { try { c.close(); } catch (e) {} delete callsRef.current[peerId]; }
    setVoicePeers((prev) => prev.filter((x) => x !== peerId));
  };

  // Kivel kell hangkapcsolatot tartani? (mindenki a szobaban, rajtam kivul)
  const voiceRoster = () => {
    const me = myPeerIdRef2.current;
    const ids = [];
    const src = netRole === 'host' ? players : ((snap && snap.players) || players);
    (src || []).forEach((p) => { if (p.peerId && p.peerId !== me) ids.push(p.peerId); });
    if (netRole !== 'host' && roomCode) {
      const hostId = `cbeats-${roomCode}`;
      if (hostId !== me && !ids.includes(hostId)) ids.push(hostId);
    }
    return ids;
  };

  const callPeer = (peerId) => {
    const peer = peerRef.current;
    const stream = localStreamRef.current;
    if (!peer || !stream || !peerId || callsRef.current[peerId]) return;
    try {
      const call = peer.call(peerId, stream);
      if (!call) return;
      callsRef.current[peerId] = call;
      call.on('stream', (rs) => attachRemote(peerId, rs));
      call.on('close', () => dropRemote(peerId));
      call.on('error', () => dropRemote(peerId));
    } catch (e) {}
  };

  const voiceStart = async () => {
    if (voiceOn || voiceBusy) return;
    if (!peerRef.current) { showToast('Előbb csatlakozz egy szobához!'); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('A böngésző nem enged mikrofont. Ha alkalmazásból (pl. Messenger) nyitottad meg, nyisd meg Safariban/Chrome-ban!');
      return;
    }
    setVoiceBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      voiceOnRef.current = true;
      setVoiceOn(true);
      setVoiceMuted(false);
      // Csak a "nagyobb" azonositokat hivjuk, a tobbi minket hiv -> nincs dupla kapcsolat
      const me = myPeerIdRef2.current || '';
      voiceRoster().forEach((pid) => { if (me < pid) callPeer(pid); });
      showToast('🎧 Hangcsatorna bekapcsolva — hallanak a többiek!');
    } catch (e) {
      showToast('🎙️ Nem sikerült a mikrofon — engedélyezd a böngészőben!');
    }
    setVoiceBusy(false);
  };

  const voiceStop = () => {
    voiceOnRef.current = false;
    Object.keys(callsRef.current).forEach((pid) => dropRemote(pid));
    callsRef.current = {};
    const st = localStreamRef.current;
    if (st) { try { st.getTracks().forEach((t) => t.stop()); } catch (e) {} }
    localStreamRef.current = null;
    setVoiceOn(false);
    setVoicePeers([]);
    showToast('🔇 Hangcsatorna kikapcsolva.');
  };

  const setMicEnabled = (on) => {
    const st = localStreamRef.current;
    if (!st) return;
    try { st.getAudioTracks().forEach((t) => { t.enabled = on; }); } catch (e) {}
  };
  const toggleVoiceMute = () => {
    const m = !voiceMuted;
    setVoiceMuted(m);
    setMicEnabled(!m);
    haptics.tick && haptics.tick();
  };

  // Uj jatekos erkezik -> hivjuk (ha mar be van kapcsolva a hang)
  useEffect(() => {
    if (!voiceOn) return;
    const me = myPeerIdRef2.current || '';
    const roster = voiceRoster();
    roster.forEach((pid) => { if (me < pid && !callsRef.current[pid]) callPeer(pid); });
    // aki kilepett, annak bontjuk
    Object.keys(callsRef.current).forEach((pid) => { if (!roster.includes(pid)) dropRemote(pid); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn, players, snap, roomCode, netRole]);

  // Dal alatt automatikus nemitas (kulonben a hangszorobol visszahallatszik a zene)
  useEffect(() => {
    if (!voiceOn || !voiceDuck) return;
    if (isPlaying) setMicEnabled(false);
    else setMicEnabled(!voiceMuted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, voiceOn, voiceDuck, voiceMuted]);

  // ---------- Hangvezerles (Push-to-Talk, Web Speech API) ----------
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const advanceMic = (n) => {
    micStepRef.current = n;
    setMicStep(n);
  };
  const resetMic = () => { micStepRef.current = 0; setMicStep(0); };

  const MIC_STEPS = [
    { key: 'year',   label: 'MONDD BE AZ ÉVSZÁMOT', hint: 'pl. „ezerkilencszáznyolcvankettő" vagy „nyolcvankettő"' },
    { key: 'artist', label: 'MONDD BE AZ ELŐADÓT',  hint: 'pl. „Michael Jackson"' },
    { key: 'title',  label: 'MONDD BE A DAL CÍMÉT', hint: 'amire emlékszel a címből' },
  ];

  const micStart = () => {
    if (!SR || micOn) return;
    const step = micStepRef.current;
    if (step > 2) return;
    try {
      const r = new SR();
      r.lang = 'hu-HU';
      r.interimResults = false;
      r.maxAlternatives = 3;
      r.onresult = (ev) => {
        const res = ev.results[0];
        const said = (res && res[0] ? res[0].transcript : '').trim();
        if (!said) return;

        // Minden valtozatot megnezunk evszamra (a felismeres tobb tippet ad)
        let year = null;
        if (res) {
          for (let i = 0; i < res.length && year === null; i++) {
            year = parseSpokenYear(res[i].transcript);
          }
        }

        const cur = micStepRef.current;
        setBetData((d) => {
          const next = { ...d };
          if (year !== null) {
            // Evszamot mindig az ev-mezobe tesszuk, barmelyik lepesnel hangzott el
            next.year = String(year);
          } else if (cur === 0) {
            // Evszam-lepesben nem ertettuk szamnak
            next.year = d.year;
          } else if (cur === 1) {
            next.artist = said;
          } else if (cur === 2) {
            next.title = said;
          }
          return next;
        });

        if (year !== null) {
          sfx.coin();
          showToast(`🎙️ Évszám: ${year}`);
          if (cur === 0) advanceMic(1);
          else advanceMic(cur + 1);
        } else if (cur === 0) {
          showToast(`🎙️ „${said}" — ezt nem értettem évszámnak. Próbáld újra, vagy írd be!`);
        } else {
          sfx.coin();
          showToast(`🎙️ ${cur === 1 ? 'Előadó' : 'Cím'}: ${said}`);
          advanceMic(cur + 1);
        }
      };
      r.onend = () => setMicOn(false);
      r.onerror = (e) => {
        setMicOn(false);
        if (e && e.error === 'not-allowed') showToast('🎙️ Engedélyezd a mikrofont a böngésző beállításaiban!');
        else if (e && e.error === 'no-speech') showToast('🎙️ Nem hallottam semmit — tartsd nyomva és beszélj!');
        else showToast('🎙️ Nem sikerült — próbáld újra!');
      };
      recogRef.current = r;
      r.start();
      setMicOn(true);
      haptics.tick && haptics.tick();
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
    {
      key: 'blind', icon: <EyeOff size={18} />, name: 'Blind Mode',
      desc: 'Az idővonalon nem látszanak az évszámok.',
      long: 'A már lerakott kártyáidon nem jelenik meg az évszám — csak az előadó és a dal címe látszik.\n\nNeked kell fejben tartanod, mit hova tettél. Ugyanaz a játék, sokkal nagyobb koncentrációval. Gyakorlott játékosoknak ajánljuk.',
    },
    {
      key: 'speed', icon: <Timer size={18} />, name: 'Speed Run',
      desc: 'Két perc alatt a leghosszabb idővonal nyer.',
      long: 'A meccs indulásakor elindul egy kétperces visszaszámláló, és nem a 10 kártya összegyűjtése a cél.\n\nAmikor lejár az idő, az nyer, akinek a leghosszabb helyes idővonala van. Gyors döntések, pörgős parti — akkor jó választás, ha kevés az időtök.',
    },
    {
      key: 'gold', icon: <Sparkles size={18} />, name: 'Arany Kártya',
      desc: 'Ha eltalálod az arany lapot, újra te jössz.',
      long: 'Játék közben véletlenszerűen felbukkan egy arany kártya — nagyjából minden ötödik körben.\n\nHa ezt a lapot a helyes helyre teszed az idővonaladon, a kör nem száll tovább: azonnal jöhet a következő dalod is. Egyetlen jó tipp így két lapot is érhet.\n\nHa mellétalálsz, minden a szokásos módon folytatódik — az arany kártya csak nyerni tud, veszíteni nem.',
    },
    {
      key: 'steal', icon: <Zap size={18} />, name: 'Rablás', online: true,
      desc: 'Bárki beelőzhet a soron lévő játékos helyett.',
      long: 'Alapból online szobában csak az tud lerakni és tippelni, akinek épp a köre van — a többiek képernyőjén a gombok zárva vannak.\n\nHa ezt bekapcsolod, a zár feloldódik: bárki lecsaphat a kártyára, ha gyorsabb. Kaotikus, hangos és nagyon vicces — de csak akkor javasoljuk, ha mindenki tudja, hogy erre megy a játék.\n\nKikapcsolva marad a rendes, körökre osztott játék.',
    },
    {
      key: 'reverse', icon: <Rewind size={18} />, name: 'Reverse Mode',
      desc: 'A zenei részlet visszafelé szól.',
      long: 'A dal fordítva játszódik le. Elsőre teljes káosz, de a dallamvezetés és a ritmus meglepően sokat elárul.\n\nKomoly kihívás — akkor érdemes bekapcsolni, ha már unjátok a szokásos menetet.',
    },
    {
      key: 'veto', icon: <ShieldAlert size={18} />, name: 'Óvás', online: true,
      desc: 'A többiek megóvhatják a lerakásodat.',
      long: 'Csak online szobában, több játékossal működik.\n\nAmikor valaki lerak egy lapot, a többieknek 5 másodpercük van megóvni a döntést, ha szerintük rossz helyre került.\n\nHa az óvás jogos — a lerakás tényleg hibás volt: a lerakó kimarad a következő körből, az óvó pedig kap 1 zsetont.\n\nHa az óvás alaptalan — a lerakás jó volt: az óvó veszít 1 zsetont, a lerakó pedig kap egyet.\n\nAz óvás tehát kockázatos. Csak akkor érdemes élni vele, ha tényleg biztos vagy a dolgodban.',
    },
    {
      key: 'pranks', icon: <Zap size={18} />, name: 'Zavarás', online: true,
      desc: 'Zavaró akciók a soron lévő játékos ellen.',
      long: 'Csak online szobában működik.\n\nHa pontosan eltalálod egy dal évszámát, kapsz érte egy zavarás-tokent.\n\nA tokent akkor használhatod, amikor valaki más van soron. Kétféle akció közül választhatsz: a Rövidzárlat pár másodpercre összekavarja a másik képernyőjét, a Riasztás pedig erős rezgést és hangjelzést küld a telefonjára.\n\nEgy token egy akció. Senkinek nem árt és pontot sem von le — csak megnehezíti a koncentrálást. Barátságos ugratás, nem büntetés.',
    },
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
                <div key={m.key} className={`mode-row ${modes[m.key] ? 'on' : ''}`}>
                  <button type="button" className="mr-main" onClick={() => toggleMode(m.key)}>
                    <span className="mr-icon">{m.icon}</span>
                    <span className="mr-body">
                      <span className="mr-name">{m.name}{m.online && <span className="mr-tag">ONLINE</span>}</span>
                      <span className="mr-desc">{m.desc}</span>
                    </span>
                    <span className={`mr-toggle ${modes[m.key] ? 'on' : ''}`} />
                  </button>
                  <button type="button" className="mr-info" onClick={() => setInfoMode(m)} aria-label={`${m.name} — részletes leírás`}>
                    <Info size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="settings-note">A módok a meccs INDÍTÁSAKOR rögzülnek — játék közben már nem változnak.</div>

            <h3 className="modal-title small">BETŰVADÁSZAT</h3>
            <div className="hunt-row">
              <input
                type="text"
                inputMode="text"
                maxLength={1}
                className="hunt-input"
                placeholder="?"
                value={letterHunt}
                onChange={(e) => setLetterHunt(e.target.value.slice(0, 1))}
                aria-label="Betű vagy szám a betűvadászathoz"
              />
              <div className="hunt-info">
                {letterHunt.trim()
                  ? (() => {
                      const res = huntFilter(getPack(selectedPack).data, letterHunt);
                      const need = WIN_CARDS + 6;
                      if (res.data.length < need) return <span className="hunt-warn">Csak {res.data.length} ilyen dal — válassz gyakoribb betűt!</span>;
                      return <span>Csak „{res.ch.toUpperCase()}” {res.mode === 'any' ? '(előadó nevében bárhol)' : 'keresztnevű előadók'} — {res.data.length} dal.</span>;
                    })()
                  : <span>Adj meg egy betűt vagy számot: csak azok a dalok jönnek, ahol az előadó keresztneve tartalmazza. Üresen hagyva mindenki játszik.</span>}
              </div>
              {letterHunt.trim() && (
                <button type="button" className="hunt-clear" onClick={() => setLetterHunt('')} aria-label="Törlés"><X size={15} /></button>
              )}
            </div>

            <h3 className="modal-title small">APPLE MUSIC — TELJES DALOK</h3>
            <div className="am-panel">
              <div className="am-head">
                <span className="am-ico"><Volume2 size={18} /></span>
                <div className="am-heads">
                  <span className="am-title">Teljes dalok lejátszása</span>
                  <span className="am-sub">Apple Music előfizetéssel a teljes szám szól a rövid részlet helyett — a játékon belül, spoiler nélkül.</span>
                </div>
                <button
                  type="button"
                  className={`mr-toggle ${appleOn ? 'on' : ''}`}
                  onClick={() => {
                    const v = !appleOn;
                    setAppleOn(v);
                    try { localStorage.setItem('cb_apple_on', v ? '1' : '0'); } catch (e) {}
                  }}
                  aria-label="Apple Music be/ki"
                />
              </div>

              {appleOn && (
                <div className="am-body">
                  <label className="am-label" htmlFor="am-token">Fejlesztői token (JWT)</label>
                  <textarea
                    id="am-token"
                    className="am-token"
                    rows={2}
                    placeholder="eyJhbGciOiJFUzI1NiIsImtpZCI6…"
                    value={appleToken}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setAppleToken(v);
                      try { localStorage.setItem('cb_apple_token', v); } catch (er) {}
                    }}
                  />
                  <div className={`am-status s-${appleState}`}>
                    {appleState === 'off' && 'Add meg a tokent a folytatáshoz.'}
                    {appleState === 'loading' && 'MusicKit betöltése…'}
                    {appleState === 'ready' && 'Kész — koppints a csatlakozásra.'}
                    {appleState === 'authed' && (appleTrack ? 'Csatlakozva — ehhez a dalhoz van teljes változat.' : 'Csatlakozva. (Ehhez a dalhoz nincs találat — a részlet szól.)')}
                    {appleState === 'error' && 'Hibás vagy lejárt token — ellenőrizd.'}
                  </div>
                  {appleState === 'authed' ? (
                    <button type="button" className="am-btn out" onClick={appleDisconnect}>LECSATLAKOZÁS</button>
                  ) : (
                    <button type="button" className="am-btn" onClick={appleConnect} disabled={appleState !== 'ready'}>
                      CSATLAKOZÁS AZ APPLE MUSIC-HOZ
                    </button>
                  )}
                  <div className="am-note">
                    A tokent a saját Apple Developer fiókodban készíted (MusicKit azonosító + privát kulcs). Csak ezen az eszközön tárolódik.
                    Reverse módban és találat híján automatikusan a rövid részlet szól.
                  </div>
                </div>
              )}
            </div>

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

  // Hangcsatorna-vezerlo (a szoba-ablakban es a jatek kozben)
  const VoiceControl = ({ compact }) => {
    if (!netRole) return null;
    if (compact) {
      return (
        <div className="vc-chip">
          <button
            type="button"
            className={`vc-btn ${voiceOn ? 'on' : ''}`}
            onClick={voiceOn ? voiceStop : voiceStart}
            disabled={voiceBusy}
            aria-label={voiceOn ? 'Hangcsatorna kikapcsolása' : 'Hangcsatorna bekapcsolása'}
          >
            <Headphones size={14} />
          </button>
          {voiceOn && (
            <button
              type="button"
              className={`vc-btn mute ${voiceMuted ? 'muted' : ''}`}
              onClick={toggleVoiceMute}
              aria-label={voiceMuted ? 'Mikrofon vissza' : 'Némítás'}
            >
              <Mic size={14} />
              {voiceMuted && <span className="vc-slash" />}
            </button>
          )}
          {voiceOn && voicePeers.length > 0 && <span className="vc-count">{voicePeers.length}</span>}
        </div>
      );
    }
    return (
      <div className="vc-panel">
        <div className="vc-head">
          <span className="vc-ico"><Headphones size={18} /></span>
          <div className="vc-heads">
            <span className="vc-title">Beszéljetek játék közben</span>
            <span className="vc-sub">
              {voiceOn
                ? (voicePeers.length ? `Élő kapcsolat ${voicePeers.length} játékossal.` : 'Bekapcsolva — várjuk a többieket…')
                : 'Hangcsatorna a szobában lévőkkel, külön app nélkül.'}
            </span>
          </div>
          <button
            type="button"
            className={`mr-toggle ${voiceOn ? 'on' : ''}`}
            onClick={voiceOn ? voiceStop : voiceStart}
            disabled={voiceBusy}
            aria-label="Hangcsatorna be/ki"
          />
        </div>
        {voiceOn && (
          <div className="vc-body">
            <button type="button" className={`vc-mute-wide ${voiceMuted ? 'muted' : ''}`} onClick={toggleVoiceMute}>
              <Mic size={16} /> {voiceMuted ? 'MIKROFON NÉMÍTVA — KOPPINTS A VISSZAKAPCSOLÁSHOZ' : 'MIKROFON ÉL — KOPPINTS A NÉMÍTÁSHOZ'}
            </button>
            <button
              type="button"
              className={`mode-row slim ${voiceDuck ? 'on' : ''}`}
              onClick={() => {
                const v = !voiceDuck;
                setVoiceDuck(v);
                try { localStorage.setItem('cb_voice_duck', v ? '1' : '0'); } catch (e) {}
              }}
            >
              <span className="mr-icon"><Volume2 size={16} /></span>
              <span className="mr-body">
                <span className="mr-name">Némítás a dal alatt</span>
                <span className="mr-desc">Amíg szól a zene, a mikrofonod néma — így nem visszhangzik.</span>
              </span>
              <span className={`mr-toggle ${voiceDuck ? 'on' : ''}`} />
            </button>
          </div>
        )}
      </div>
    );
  };

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
                    <VoiceControl />

                    <div className="room-roster">
                      <span className="rr-title">CSATLAKOZOTT ({players.length})</span>
                      <div className="rr-list">
                        {players.map((p) => (
                          <span key={p.id} className="rr-chip">
                            {p.name}{!p.peerId && <em> (te)</em>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-3d start wide room-start"
                      disabled={players.length < 2}
                      onClick={() => { setShowRoom(false); startGame(); }}
                    >
                      <Play size={17} /> {players.length < 2 ? 'VÁRUNK MÉG JÁTÉKOSRA…' : `JÁTÉK INDÍTÁSA (${players.length} JÁTÉKOS)`}
                    </button>
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

                {smartPacks.length > 0 && (
                  <>
                    <div className="pack-sect">
                      <span className="ps-title"><Sparkles size={13} /> NEKED AJÁNLOTT</span>
                      <span className="ps-sub">A saját adatbázisból generálva — naponta frissül.</span>
                    </div>
                    <div className="pack-grid">
                      {smartPacks.map((sp) => (
                        <button
                          key={sp.key}
                          className={`pack-card smart ${selectedPack === sp.key ? 'selected' : ''}`}
                          style={{ background: sp.style }}
                          onClick={() => { setSelectedPack(sp.key); setShowPackSelection(false); }}
                        >
                          {sp.personal && <span className="pc-badge">NEKED</span>}
                          <h3>{sp.label}</h3>
                          <p>{sp.desc}</p>
                          <span className="pack-count">{sp.data.length} dal · {sp.meta}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="pack-sect">
                  <span className="ps-title"><Layers size={13} /> ÁLLANDÓ PAKLIK</span>
                </div>
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
        <Backdrop />
        {ToastView}
        <div className="menu-scroll">
          {/* 1. Fejlec: csak a fogaskerek (az overline szandekosan kimarad) */}
          <div className="menu-head">
            <span />
            <button type="button" className="gear-ghost" onClick={() => setShowSettings(true)} aria-label="Beállítások">
              <Settings size={20} />
            </button>
          </div>

          {/* 2. Marka + karakter-szinpad (kozepre rendezve) */}
          <div className="cb-logo bob" style={{ animationDelay: '0.2s' }}>
            <ChronoLogo />
          </div>

          <MenuCarousel
            active={menuIndex}
            setActive={setMenuIndex}
            onSelect={(key) => {
              if (key === 'start') setStatus('setup');
              else if (key === 'bot') setShowBot(true);
              else if (key === 'online') setShowRoom(true);
              else if (key === 'pack') setShowPackSelection(true);
              else if (key === 'modes') setShowSettings(true);
            }}
            items={[
              { key: 'start', cls: 'c-start', icon: <IcoVinyl />, title: 'JÁTÉK INDÍTÁSA', meta: 'Helyi parti · add hozzá a csapatot', cta: 'INDÍTÁS' },
              { key: 'bot', cls: 'c-bot', icon: <IcoBot />, title: 'CHRONO-BOT', meta: botDiff ? `${botDiff} fokozat` : 'Gyakorolj gép ellen' },
              { key: 'online', cls: 'c-online', icon: <IcoPhone />, title: 'ONLINE SZOBA', meta: netRole === 'host' ? `Kód: ${roomCode}` : 'Kód vagy QR-kód' },
              { key: 'pack', cls: 'c-pack', icon: <IcoPack />, title: 'PAKLI', meta: `${getPack(selectedPack).label} · ${getPack(selectedPack).data.length} dal` },
              { key: 'modes', cls: 'c-modes', icon: <IcoModes />, title: 'EXTRA MÓDOK', meta: modeN ? `${modeN} aktív` : 'Blind, Speed, Vétó…' },
            ]}
          />

        </div>

        {SettingsView}
        {ModeInfoView}
        {InstallView}
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
            <VoiceControl compact />
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
                  <span className="vp-text">{active.name} lerakta a lapot.<br />Szerinted rossz helyre került?</span>
                  <button type="button" className="veto-btn" onClick={() => sendAction('veto')}><ShieldAlert size={16} /> ÓVÁST EMELEK</button>
                  <span className="vp-warn">Ha az óvás alaptalan: -1 zseton.</span>
                </motion.div>
              ) : (
                <Pedestal charIndex={active.char} size={150} mood={st.playing ? 'win' : 'idle'} />
              )}
              {me && st.activeModes && st.activeModes.pranks && (me.pranks || 0) > 0 && st.status === 'game' && (
                <div className="prank-bar glass">
                  <span className="pb-title"><Zap size={14} /> ZAVARÁS ({me.pranks})</span>
                  <div className="pb-btns">
                    <button type="button" className="prank-btn" onClick={() => sendAction('prank', { kind: 'scramble' })}><Zap size={13} /> Rövidzárlat</button>
                    <button type="button" className="prank-btn" onClick={() => sendAction('prank', { kind: 'heartbeat' })}><Vibrate size={13} /> Riasztás</button>
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
        {ModeInfoView}
        {InstallView}
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
                  ? <>Aktív: {[modes.blind && 'Blind', modes.speed && 'Speed', modes.gold && 'Arany Kártya', modes.reverse && 'Reverse', modes.veto && 'Óvás', modes.pranks && 'Zavarás'].filter(Boolean).join(' · ')}</>
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
  // Online szobaban a gazda gepen NE lehessen lerakni, ha epp egy tavoli jatekos kore van
  const remoteTurn = netRole === 'host' && players[turnIndex] && !!players[turnIndex].peerId;
  const lockedByTurn = remoteTurn && !activeModes.steal;
  const slotsDisabled = flipped || !!feedback || lockedByTurn;
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
        {ModeInfoView}
        {InstallView}

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
          <button
            className={`btn-3d swap inline ${isAudioBroken ? 'error' : ''}`}
            onClick={handleSwap}
            disabled={slotsDisabled}
            title={isAudioBroken ? 'Ingyenes csere — a dal nem elérhető' : `Új dal húzása ${SWAP_COST} zsetonért`}
          >
            {isAudioBroken ? <AlertTriangle size={15} /> : <RefreshCw size={15} />}
            <span className="sw-txt">{isAudioBroken ? 'INGYEN' : 'CSERE'}</span>
            {!isAudioBroken && <span className="sw-cost">{SWAP_COST}🪙</span>}
          </button>
        </div>
        <div className="hud-right">
          {timeLeft !== null && (
            <div className={`timer-chip glass ${timeLeft <= 20 ? 'low' : ''}`}>
              <Timer size={13} /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </div>
          )}
          {(activeModes.blind || activeModes.speed || activeModes.gold || activeModes.reverse) && (
            <div className="deck-chip glass" title="Aktív játékmódok">
              {activeModes.blind && <EyeOff size={13} />}{activeModes.speed && <Timer size={13} />}{activeModes.gold && <Sparkles size={13} />}{activeModes.reverse && <Rewind size={13} />}{activeModes.veto && <ShieldAlert size={13} />}{activeModes.pranks && <Zap size={13} />}
            </div>
          )}
        </div>
      </div>

      {/* ---------- SZINPAD ---------- */}
      <div className="main-arena">
        <div className="game-char">
          <CharacterStage charIndex={activePlayer.char} size={142} mood={isPlaying ? 'win' : 'idle'} />
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
            onClick={() => { resetMic(); setShowBetModal(true); }}
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
              {SR ? (
                <div className="mic-zone">
                  <div className="mic-steps">
                    {MIC_STEPS.map((st2, i) => (
                      <span
                        key={st2.key}
                        className={`ms-dot ${i === micStep ? 'on' : ''} ${betData[st2.key] ? 'done' : ''}`}
                      >
                        {betData[st2.key] ? <CheckCircle size={13} /> : i + 1}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    className={`mic-round ${micOn ? 'live' : ''} ${micStep > 2 ? 'done' : ''}`}
                    onPointerDown={micStep > 2 ? undefined : micStart}
                    onPointerUp={micStop}
                    onPointerLeave={micStop}
                    onContextMenu={(e) => e.preventDefault()}
                    aria-label={micStep > 2 ? 'Kész' : MIC_STEPS[micStep].label}
                  >
                    <span className="mr-ring" />
                    <span className="mr-ring r2" />
                    {micStep > 2 ? <CheckCircle size={34} /> : <Mic size={34} />}
                  </button>

                  <div className="mic-prompt">
                    {micOn ? (
                      <span className="mp-live">HALLGATLAK… engedd el, ha kész</span>
                    ) : micStep > 2 ? (
                      <>
                        <span className="mp-label">MEGVAN MINDEN!</span>
                        <button type="button" className="mp-again" onClick={resetMic}>Újrakezdem a bemondást</button>
                      </>
                    ) : (
                      <>
                        <span className="mp-label">{MIC_STEPS[micStep].label}</span>
                        <span className="mp-hint">Tartsd nyomva a gombot · {MIC_STEPS[micStep].hint}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mic-unsupported">
                  <Mic size={18} />
                  <span>
                    Ez a böngésző nem támogatja a beszédfelismerést, ezért a bemondás itt nem elérhető.
                    {isIOSDevice ? ' iPhone-on és iPaden egyik böngésző sem tudja (az Apple nem építette be) — írd be a tippet kézzel.' : ' Androidon a Chrome, gépen a Chrome vagy Edge támogatja.'}
                  </span>
                </div>
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