import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, X, XCircle, CheckCircle, RefreshCw, Coins,
  MessageCircle, AlertTriangle, Trophy, Layers, ChevronRight,
  Settings, Mic, BookOpen, Timer, EyeOff, Rewind, Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import Peer from 'peerjs';
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
const T = 'https://raw.githubusercontent.com/mrdoob/three.js/r160/examples/models/gltf';
const K = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0';
// ============================================================
//  KARAKTEREK
//  A dims ertekek GEPPEL MERT valodi meretek (magassag, talppont,
//  kozeppont) - igy minden karakter pontosan egyforma magas.
//
//  SAJAT FIGURAK - EGYSZERU RENDSZER:
//  1. A projekt GYOKEREBEN hozz letre egy  public  mappat,
//     azon belul egy  models  mappat  ->  public/models
//  2. Masold bele a figuraidat SORSZAMOZVA:  1.glb, 2.glb, 3.glb ...
//     (kihagyas nelkul; az elso hianyzo szamnal megall a kereses)
//  3. KESZ! Inditaskor automatikusan megtalalja, bemeri es
//     hozzaadja oket a valaszthato karakterekhez.
// ============================================================
const CUSTOM_COLORS = ['#ff8c42', '#7dff6a', '#ff5dde', '#5da9ff', '#fff35d', '#ff6a6a', '#6affd8', '#c46aff', '#ffa1c9', '#9dff5d'];

const CHARACTERS = [
  { name: 'Robi, a DJ-robot',  url: `${T}/RobotExpressive/RobotExpressive.glb`, idle: ['Idle'], win: ['Dance'], color: '#00eaff',
    dims: { h: 4.46, minY: -0.02, cx: 0, cz: 0.07 } },
  { name: 'Kommandós Karcsi',  url: `${T}/Soldier.glb`, idle: ['Idle'], win: ['Run'], color: '#00ff87',
    dims: { h: 1.83, minY: 0, cx: 0, cz: 0 } },
  { name: 'Tánci Tóni',        url: `${T}/Xbot.glb`, idle: ['idle'], win: ['run'], color: '#ff5d8a',
    dims: { h: 1.83, minY: 0, cx: 0, cz: 0 } },
  { name: 'Melós Miki',        url: `${K}/CesiumMan/glTF-Binary/CesiumMan.glb`, idle: [], win: [], color: '#ffd700',
    dims: { h: 1.51, minY: 0, cx: 0, cz: 0.03 } },
  { name: 'Diszkó Dönci',      url: `${K}/BrainStem/glTF-Binary/BrainStem.glb`, idle: [], win: [], color: '#b385ff',
    dims: { h: 1.83, minY: 0, cx: -0.04, cz: -0.04 } },
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

function CharacterStage({ charIndex, size = 200, mood = 'idle' }) {
  const c = CHARACTERS[charIndex % CHARACTERS.length];
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
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.15, 4.6], fov: 40 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 6, 4]} intensity={2.4} />
        <directionalLight position={[-5, 3, -4]} intensity={1.2} color="#7fdcff" />
        <pointLight position={[0, -2, 3]} intensity={0.7} color="#ff4d8a" />
        <Suspense fallback={null}>
          <SpinGroup spinRef={spinRef}>
            <CharModel url={c.url} prefer={prefer} mood={mood} dims={c.dims} />
          </SpinGroup>
        </Suspense>
      </Canvas>
    </div>
  );
}

const APP_VERSION = 'v8';

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
const isCloseEnough = (str1, str2) => {
  if (!str1 || !str2) return false;
  const s1 = String(str1).trim().toLowerCase();
  const s2 = String(str2).trim().toLowerCase();
  if (s1 === s2) return true;
  if (Math.abs(s1.length - s2.length) > 1) return false;
  let i = 0, j = 0, mistakes = 0;
  while (i < s1.length && j < s2.length) {
    if (s1[i] !== s2[j]) {
      mistakes++;
      if (mistakes > 1) return false;
      if (s1.length > s2.length) i++;
      else if (s2.length > s1.length) j++;
      else { i++; j++; }
    } else { i++; j++; }
  }
  if (i < s1.length || j < s2.length) mistakes++;
  return mistakes <= 1;
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

const fireConfetti = (power = 1) => {
  confetti({
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
  const [status, setStatus] = useState('setup');
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
    try { return { blind: false, speed: false, gold: false, reverse: false, ...(JSON.parse(localStorage.getItem('cb_modes') || '{}')) }; }
    catch (e) { return { blind: false, speed: false, gold: false, reverse: false }; }
  });
  const [showSettings, setShowSettings] = useState(false);

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
  const peerRef = useRef(null);
  const connsRef = useRef({});                          // host: peerId -> conn
  const hostConnRef = useRef(null);                     // kliens: kapcsolat a hosthoz
  const actRef = useRef({});                            // friss fuggvenyek a peer-hendlereknek
  const [activeModes, setActiveModes] = useState({ blind: false, speed: false, gold: false, reverse: false });
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
      el.scrollTo({ left: (el.scrollWidth - el.clientWidth) / 2, behavior: 'smooth' });
    }
  }, [status, turnIndex]);

  useEffect(() => {
    if (wrongIndex !== null && ghostRef.current && scrollRef.current) {
      const track = scrollRef.current;
      const ghost = ghostRef.current;
      const target = ghost.offsetLeft - track.clientWidth / 2 + ghost.clientWidth / 2;
      track.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
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
    setStatus('handoff');
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
    if (earned > 0) {
      fireConfetti(Math.min(earned, 3));
      setPlayers(players.map((p, i) => (i === turnIndex ? { ...p, tokens: p.tokens + earned } : p)));
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
    setTurnIndex((i) => (i + 1) % players.length);
    turnCountRef.current += 1;
    const gold = activeModes.gold && turnCountRef.current % 3 === 0;
    setGoldCard(gold);
    if (gold) showToast('✨ ARANY KÁRTYA! Dupla tippnyeremény + 2 bónuszzseton a helyes lerakásért!');
    setCurrentCard(c);
    setStatus('handoff');
  };

  const handlePlace = (index) => {
    if (flipped || feedback || !currentCard) return;
    pauseMusic();
    setFlipped(true);

    const tl = players[turnIndex].timeline;
    const y = currentCard.y;
    let valid = true;
    if (index > 0 && tl[index - 1].y > y) valid = false;
    if (index < tl.length && tl[index].y < y) valid = false;

    if (valid) {
      missStreakRef.current = 0;
      setFeedback('correct');
      fireConfetti(2);
      confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: ['#ffd700', '#00eaff', '#ffffff'] });
      confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: ['#ffd700', '#ff0055', '#ffffff'] });
      const goldBonus = goldCard ? 2 : 0;
      if (goldBonus) showToast('✨ Arany Kártya bónusz: +2 🪙');
      const newTL = [...tl];
      newTL.splice(index, 0, currentCard);
      const updated = players.map((p, i) => (i === turnIndex ? { ...p, timeline: newTL, tokens: p.tokens + goldBonus } : p));
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

  // ============================================================
  //  ONLINE SZOBA - halozati logika
  // ============================================================
  // Minden rendernel frissitjuk, igy a peer-esemenyek mindig a
  // legfrissebb allapotot es fuggvenyeket erik el (nincs "beragadas")
  actRef.current = { players, turnIndex, status, handlePlace, handleSwap, currentCard, showToast, setPlayers, setBetResult, fireConfetti, goldCard };

  const makeCode = () => {
    const AB = 'ABCDEFGHJKLMNPRSTUVWXYZ';
    let c = '';
    for (let i = 0; i < 4; i++) c += AB[Math.floor(Math.random() * AB.length)];
    return c;
  };

  const netSnapshot = () => ({
    type: 'state',
    status,
    players: players.map((p) => ({ id: p.id, peerId: p.peerId || null, name: p.name, char: p.char, tokens: p.tokens || 0, timeline: p.timeline || [] })),
    turnIndex,
    cardsLeft,
    flipped,
    feedback,
    wrongIndex,
    timeLeft,
    goldCard,
    activeModes,
    card: currentCard ? (flipped || feedback ? currentCard : { masked: true }) : null,
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
  }, [netRole, players, turnIndex, currentCard, flipped, feedback, wrongIndex, status, cardsLeft, timeLeft, goldCard, activeModes]);

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
    } else if (msg.a === 'bet') {
      if (idx !== A.turnIndex || A.status !== 'game' || !A.currentCard) return;
      const d = msg.data || {};
      const ys = yearScore(d.year, A.currentCard.y);
      let earned = ys;
      if (isCloseEnough(d.artist, A.currentCard.a)) earned += 1;
      if (isCloseEnough(d.title, A.currentCard.t)) earned += 1;
      if (A.goldCard) earned *= 2;
      if (earned > 0) {
        A.fireConfetti(Math.min(earned, 3));
        A.setPlayers(A.players.map((p, i) => (i === idx ? { ...p, tokens: (p.tokens || 0) + earned } : p)));
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
    const peer = new Peer();
    peerRef.current = peer;
    peer.on('open', (pid) => {
      setMyPeerId(pid);
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
        }
      });
      conn.on('close', () => { showToast('📡 A kapcsolat megszakadt.'); setStatus('setup'); setNetRole(null); setSnap(null); });
      conn.on('error', () => { clearTimeout(failT); setNetBusy(false); showToast('Nem sikerült csatlakozni. 😕'); });
    });
    peer.on('error', () => { setNetBusy(false); showToast('Nem sikerült csatlakozni. 😕'); });
  };

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
    { key: 'reverse', icon: <Rewind size={18} />,  name: 'Reverse Mode', desc: 'A dal visszafelé szól — csak az igazi mesterek ismerik fel! 😈' },
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
  );

  // ============================================================
  //  SETUP
  // ============================================================
  // ============================================================
  //  KLIENS NEZET (csatlakozott telefon)
  // ============================================================
  if (status === 'client') {
    const st = snap;
    const me = st ? st.players.find((p) => p.peerId === myPeerId) : null;
    const active = st && st.players[st.turnIndex];
    const myTurn = !!(st && me && active && active.peerId === myPeerId && st.status === 'game');
    const myChar = me ? CHARACTERS[me.char % CHARACTERS.length] : CHARACTERS[0];
    const canAct = myTurn && !st.flipped && !st.feedback;
    const tl = me ? me.timeline : [];
    return (
      <div className="app-container">
        <Backdrop />
        <div className="ver-tag">{APP_VERSION}</div>
        {ToastView}
        <div className="top-hud">
          <div className="player-info glass" style={{ '--pc': myChar.color }}>
            <div className="hud-avatar"><span>{me ? me.name.charAt(0).toUpperCase() : '?'}</span></div>
            <div className="hud-text">
              <div className="hud-label">TE VAGY</div>
              <div className="hud-name">{me ? me.name : '…'}</div>
            </div>
            <span className="hud-tokens"><Coins size={15} /> {me ? me.tokens : 0}</span>
          </div>
          <div className="hud-right">
            <div className="deck-chip glass">🚪 {roomCode}</div>
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
            <div className="client-banner glass">
              <span className="cb-big">🎧 {active.name} játszik…</span>
              <span className="cb-sub">Figyeld a zenét a házigazda készülékén!</span>
            </div>
          )}
          {st && st.status === 'win' && (
            <div className="client-banner glass">
              <span className="cb-big">🏆 Vége a meccsnek!</span>
              <span className="cb-sub">Az eredmény a házigazda képernyőjén!</span>
            </div>
          )}
          {myTurn && (
            <>
              <div className="client-banner glass mine">
                <span className="cb-big">🎤 TE JÖSSZ!</span>
                <span className="cb-sub">{st.card && !st.card.masked ? `${st.card.y} · ${st.card.t}` : 'Hallgasd meg a dalt a házigazdánál, aztán helyezd el!'}</span>
                {st.goldCard && <span className="gold-badge">✨ ARANY KÁRTYA ✨</span>}
              </div>
              {canAct && (
                <div className="client-actions">
                  <motion.button className="bet-fab" whileTap={{ scale: 0.94 }} onClick={() => setClientBet({ year: '', artist: '', title: '' })}>
                    <MessageCircle size={17} /> TIPPELJ ZSETONÉRT!
                  </motion.button>
                  <button type="button" className="btn-3d swap" onClick={() => sendAction('swap')}>
                    <RefreshCw size={16} /> CSERE {SWAP_COST}🪙
                  </button>
                </div>
              )}
              {st.feedback && (
                <div className={`client-banner glass ${st.feedback === 'correct' ? 'good' : 'bad'}`}>
                  <span className="cb-big">{st.feedback === 'correct' ? '🎉 TALÁLT!' : '😅 Nem talált…'}</span>
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
          <div className="timeline-track" ref={scrollRef}>
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

        <button type="button" className="leave-room" onClick={leaveRoom}><X size={14} /> Kilépés</button>
      </div>
    );
  }

  if (status === 'setup') {
    const cur = CHARACTERS[charIndex % CHARACTERS.length];
    return (
      <div className="app-container">
        <Backdrop />
        <div className="ver-tag">{APP_VERSION}</div>
        {ToastView}
        {SettingsView}
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
                    <p className="modal-sub">Ezt a kódot írják be a többiek a saját telefonjukon!<br />A zene ezen a készüléken fog szólni. 🔊</p>
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
        <button type="button" className="gear-btn glass gear-float" onClick={() => setShowSettings(true)} title="Játékmódok">
          <Settings size={19} />
        </button>
        <div className="setup-scroll">
          <div className="setup-card glass">
            <h1 className="text-chrome huge">CHRONO<br />BEATS</h1>

            <button className="mode-display" onClick={() => setShowPackSelection(true)}>
              <span className="mode-label">JÁTÉKMÓD</span>
              <span className="mode-value" style={{ background: SONG_PACKS[selectedPack].style }}>
                {SONG_PACKS[selectedPack].label}
              </span>
              <span className="mode-count">{SONG_PACKS[selectedPack].data.length} dal · koppints a váltáshoz</span>
            </button>

            <button className="mode-display" onClick={() => setShowRoom(true)}>
              <span className="mode-label">📱 ONLINE SZOBA</span>
              <span className="mode-count">
                {netRole === 'host'
                  ? <>Szobakód: <b className="room-code-inline">{roomCode}</b> · {players.filter((p) => p.peerId).length} telefon csatlakozva</>
                  : 'Hozz létre szobát, vagy csatlakozz kóddal!'}
              </span>
            </button>

            <button className="mode-display" onClick={() => setShowSettings(true)}>
              <span className="mode-label">⚙️ JÁTÉKMÓDOK</span>
              <span className="mode-count">
                {(modes.blind || modes.speed || modes.gold || modes.reverse)
                  ? <>Aktív: {modes.blind && '🙈 Blind '}{modes.speed && '⏱ Speed '}{modes.gold && '✨ Arany '}{modes.reverse && '🔁 Reverse'}</>
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
      <div className="app-container">
        <Backdrop />
        <div className="ver-tag">{APP_VERSION}</div>
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
      <div className="app-container">
        <Backdrop />
        <div className="ver-tag">{APP_VERSION}</div>
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
    <div className={`app-container ${shake ? 'shake' : ''} ${feedback === 'correct' ? 'winpulse' : ''}`}>
      <Backdrop />
      <div className="ver-tag">{APP_VERSION}</div>
      {ToastView}
      {feedback && <div className={`fx-overlay ${feedback === 'correct' ? 'good' : 'bad'}`} />}
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
          <div className="deck-chip glass" title="Hátralévő kártyák">🂠 {cardsLeft}</div>
          {(activeModes.blind || activeModes.speed || activeModes.gold || activeModes.reverse) && (
            <div className="deck-chip glass" title="Aktív játékmódok">
              {activeModes.blind && '🙈'}{activeModes.speed && '⏱'}{activeModes.gold && '✨'}{activeModes.reverse && '🔁'}
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
          <div className={`card-column ${goldCard ? 'gold' : ''}`}>
            {goldCard && <div className="gold-badge">✨ ARANY KÁRTYA ✨</div>}
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
          <div className="timeline-track" ref={scrollRef}>
            {feedback !== 'wrong' && (
              <button className="slot-btn" disabled={slotsDisabled} onClick={() => handlePlace(0)}>+</button>
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
                  <button className="slot-btn" disabled={slotsDisabled} onClick={() => handlePlace(i + 1)}>+</button>
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
              {goldCard && <div className="gold-badge inmodal">✨ ARANY KÁRTYA — DUPLA NYEREMÉNY! ✨</div>}
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