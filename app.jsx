import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X, Circle as XCircle, CircleCheck as CheckCircle, RefreshCw, Coins, MessageCircle, TriangleAlert as AlertTriangle, Trophy, Layers, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
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
const CHARACTERS = [
  { url: `${T}/RobotExpressive/RobotExpressive.glb`, idle: ['Idle'], win: ['Dance'], color: '#00eaff' },
  { url: `${T}/Soldier.glb`, idle: ['Idle'], win: ['Run'], color: '#00ff87' },
  { url: `${K}/CesiumMan/glTF-Binary/CesiumMan.glb`, idle: [], win: [], color: '#ffd700' },
  { url: `${K}/BrainStem/glTF-Binary/BrainStem.glb`, idle: [], win: [], color: '#b385ff' },
];

// Valodi hatarolo doboz szamitasa - csontvazas (skinned) modelleknel is pontos!
// (Ez volt a "csak a laba latszik" bug oka: a sima Box3 a csontvazas
// modelleknel rossz meretet adott, ezert a skala szetcsuszott.)
const computeRealBounds = (root) => {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  root.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.geometry.computeBoundingBox(); // mindig ujraszamoljuk: a glTF loader cache-eit elofordul, hogy rossz
      if (o.geometry.boundingBox) {
        tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        box.union(tmp);
      }
    }
  });
  return box;
};

function CharModel({ url, prefer, mood }) {
  const group = useRef();
  const gltf = useLoader(GLTFLoader, url);

  // Klonozas + EGYSEGES meretezes: minden karakter pontosan ugyanolyan
  // magas (2 egyseg), talppal a talajon, kozepre igazitva
  const { cloned, fit } = useMemo(() => {
    const c = skeletonClone(gltf.scene);
    const box = computeRealBounds(c);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const height = size.y || 1;
    const scale = 2.0 / height;
    return {
      cloned: c,
      fit: {
        scale,
        x: -center.x * scale,
        y: -box.min.y * scale - 1.0, // talp a -1.0 szinten -> senki nem log ki
        z: -center.z * scale,
      },
    };
  }, [gltf]);

  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);

  // Animacio kivalasztasa es lejatszasa
  useEffect(() => {
    const clips = gltf.animations || [];
    if (!clips.length) return undefined;
    const names = clips.map((cl) => cl.name);
    const pick = (prefer || []).find((n) => names.includes(n)) || names[0];
    const clip = clips.find((cl) => cl.name === pick);
    const action = mixer.clipAction(clip, cloned);
    action.reset();
    action.timeScale = mood === 'win' ? 1.35 : 1;
    action.fadeIn(0.25).play();
    return () => { action.fadeOut(0.2); };
  }, [gltf, mixer, cloned, prefer, mood]);

  // Lassu automatikus forgas + animacio leptetese
  useFrame((_, dt) => {
    mixer.update(dt);
    if (group.current) group.current.rotation.y += dt * (mood === 'win' ? 0.8 : 0.35);
  });

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
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.15, 4.6], fov: 40 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 6, 4]} intensity={2.4} />
        <directionalLight position={[-5, 3, -4]} intensity={1.2} color="#7fdcff" />
        <pointLight position={[0, -2, 3]} intensity={0.7} color="#ff4d8a" />
        <Suspense fallback={null}>
          <SpinGroup spinRef={spinRef}>
            <CharModel url={c.url} prefer={prefer} mood={mood} />
          </SpinGroup>
        </Suspense>
      </Canvas>
    </div>
  );
}

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

// A TE EREDETI, BEVALT MEGOLDASOD - valtoztatas nelkul visszaallitva!
// (A korabbi proxy-kiserletem ez ELE ekelodott es blokkolhatta - torolve.)
const fetchDeezerUrl = (artist, title) => {
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
  const [endReason, setEndReason] = useState('win');

  const [showBetModal, setShowBetModal] = useState(false);
  const [betData, setBetData] = useState({ year: '', artist: '', title: '' });
  const [betResult, setBetResult] = useState(null);

  const [newName, setNewName] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [selectedPack, setSelectedPack] = useState('mix');
  const [showPackSelection, setShowPackSelection] = useState(false);
  const [toast, setToast] = useState(null);

  const deckRef = useRef([]);
  const discardRef = useRef([]);
  const audioRef = useRef(null);
  const scrollRef = useRef(null);
  const ghostRef = useRef(null);
  const toastTimer = useRef(null);

  // ---------- Audio init ----------
  useEffect(() => {
    const a = new Audio();
    a.setAttribute('playsinline', 'true');
    a.setAttribute('webkit-playsinline', 'true');
    const onEnd = () => setIsPlaying(false);
    a.addEventListener('ended', onEnd);
    audioRef.current = a;
    return () => { a.removeEventListener('ended', onEnd); a.pause(); };
  }, []);

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

  const pauseMusic = () => {
    if (audioRef.current) audioRef.current.pause();
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
    setCurrentCard(firstCard);
    setStatus('handoff');
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
  const toggleMusic = () => {
    if (!audioRef.current || isLoading || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
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
      setFeedback('correct');
      fireConfetti(2);
      confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: ['#ffd700', '#00eaff', '#ffffff'] });
      confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: ['#ffd700', '#ff0055', '#ffffff'] });
      const newTL = [...tl];
      newTL.splice(index, 0, currentCard);
      const updated = players.map((p, i) => (i === turnIndex ? { ...p, timeline: newTL } : p));
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
      setShake(true);
      setTimeout(() => setShake(false), 650);
      setWrongIndex(ci);
      discardRef.current.push(currentCard);
      setTimeout(nextTurn, 3000);
    }
  };

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
  if (status === 'setup') {
    const cur = CHARACTERS[charIndex % CHARACTERS.length];
    return (
      <div className="app-container">
        <Backdrop />
        {ToastView}
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
                <button className="close-modal" onClick={() => setShowPackSelection(false)}><X size={26} /></button>
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
        {ToastView}
        <div className="win-scroll">
          <div className="win-content">
            <div className="win-trophy"><Trophy size={38} /></div>
            <h1 className="text-chrome huge">GYŐZTES</h1>
            <h2 className="winner-name" style={{ color: winnerChar.color, textShadow: `0 0 20px ${winnerChar.color}` }}>
              {winner.name}
            </h2>
            {endReason === 'deck' && <div className="deck-note">Elfogyott a pakli — a leghosszabb idővonal nyert!</div>}

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
      {ToastView}
      {feedback && <div className={`fx-overlay ${feedback === 'correct' ? 'good' : 'bad'}`} />}

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
          <div className="deck-chip glass" title="Hátralévő kártyák">🂠 {cardsLeft}</div>
          <button
            className={`btn-3d swap ${isAudioBroken ? 'error' : ''}`}
            onClick={handleSwap}
            disabled={slotsDisabled}
          >
            {isAudioBroken ? <AlertTriangle size={16} /> : <RefreshCw size={16} />}
            {isAudioBroken ? ' HIBA · INGYEN CSERE' : ` CSERE ${SWAP_COST}🪙`}
          </button>
        </div>
      </div>

      {/* ---------- SZINPAD ---------- */}
      <div className="main-arena">
        <div className="music-stage">
          <div className="tt-column">
            <Turntable isPlaying={isPlaying} isLoading={isLoading} onToggle={toggleMusic} />
            <Equalizer active={isPlaying} />
          </div>
          <div className="card-column">
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
                  <div className="year-capsule">{card.y}</div>
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
          <div className="modal-overlay">
            <motion.div
              className="modal-box glass"
              initial={{ scale: 0.85, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
            >
              <button className="close-modal" onClick={() => setShowBetModal(false)}><X size={22} /></button>
              <h2 className="text-chrome">MI A TIPPED?</h2>
              <p className="modal-sub">
                Év ±{YEAR_TOLERANCE}: 1🪙 · pontos év: 2🪙 · előadó / cím: 1-1🪙
              </p>
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
