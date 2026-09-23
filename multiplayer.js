import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const $ = id => document.getElementById(id);
const configReady = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && !firebaseConfig.apiKey.includes('PASTE_') && !firebaseConfig.projectId.includes('PASTE_');
let auth, db, uid, roomId, myPlayer, roomData, playerData = [], unsubRoom, unsubPlayers, waitingForAdvance = false;
const answersMatch = (value, variants) => {
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return variants.some(answer => normalize(answer) === normalize(value));
};
const roundQuestions = () => {
  const bank = window.questionBank || [];
  const shuffle = list => { const copy = [...list]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; };
  const categories = [['WORLD CUP',1],['WORLD CUP ARCHIVE',1],['CHAMPIONS LEAGUE',1],['CHAMPIONS LEAGUE ARCHIVE',1],['EUROPEAN CHAMPIONSHIP',1],['EUROPEAN CHAMPIONSHIP ARCHIVE',1],['COPA AMÉRICA',1],['AFCON',1],['ICONIC MOMENTS',3]];
  const round = categories.flatMap(([cat, count]) => shuffle(bank.filter(q => q.cat === cat)).slice(0, count));
  const selected = new Set(round);
  return shuffle([...round, ...shuffle(bank.filter(q => !selected.has(q))).slice(0, 15 - round.length)]);
};
function section(id, visible) { $(id).classList.toggle('hidden', !visible); }
function showMultiPanel() {
  ['intro','quiz','results','multi'].forEach(id => $(id).classList.toggle('hidden', id !== 'multi'));
  section('multiLobby', true); section('multiWaiting', false); section('multiMatch', false);
}
function lobbyMessage(message, error = false) { $('lobbyMessage').textContent = message; $('lobbyMessage').classList.toggle('error', error); }
function playerName() { return $('playerName').value.trim().replace(/[<>]/g, '').slice(0, 18) || 'FOOTBALL FAN'; }
async function connect() {
  if (!configReady) throw new Error('Add your Firebase project values to firebase-config.js, then enable Anonymous sign-in and create a Firestore database. See README for steps.');
  if (!auth) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app); db = getFirestore(app);
  }
  const credential = await signInAnonymously(auth);
  uid = credential.user.uid;
}
function clearListeners() { if (unsubRoom) unsubRoom(); if (unsubPlayers) unsubPlayers(); unsubRoom = unsubPlayers = undefined; }
function listenToRoom() {
  clearListeners();
  unsubRoom = onSnapshot(doc(db, 'rooms', roomId), snap => {
    if (!snap.exists()) { lobbyMessage('This room has expired or was removed.', true); return; }
    roomData = snap.data();
    if (roomData.status === 'waiting') { section('multiLobby', false); section('multiWaiting', true); section('multiMatch', false); $('roomCodeDisplay').textContent = roomId; }
    else if (roomData.status === 'playing' || roomData.status === 'finished') { section('multiLobby', false); section('multiWaiting', false); section('multiMatch', true); }
    refreshMultiplayer();
  }, error => lobbyMessage(error.message, true));
  unsubPlayers = onSnapshot(collection(db, 'rooms', roomId, 'players'), snap => {
    playerData = snap.docs.map(item => ({ id: item.id, ...item.data() }));
    const count = playerData.length;
    $('waitingPlayers').textContent = `${count}/8 PLAYERS · ${count < 2 ? 'NEED 2 TO KICK OFF' : 'WAITING FOR PLAYERS OR HOST TO START'}`;
    $('beginMatch').classList.toggle('hidden', !(roomData?.host === uid && count >= 2 && count <= 8 && roomData.status === 'waiting'));
    refreshMultiplayer();
  }, error => lobbyMessage(error.message, true));
}
function refreshMultiplayer() {
  if (!roomData || !myPlayer) return;
  const me = playerData.find(p => p.id === uid);
  if (me) myPlayer = me;
  if (!me) return;
  const standings = [...playerData].sort((a, b) => (b.score || 0) - (a.score || 0) || a.name.localeCompare(b.name));
  const list = $('multiStandings');
  list.replaceChildren();
  standings.forEach((player, index) => {
    const row = document.createElement('div'); row.className = `standing-row${player.id === uid ? ' is-you' : ''}`;
    const rank = document.createElement('span'); rank.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('span'); name.textContent = player.id === uid ? `${player.name} (YOU)` : player.name;
    const points = document.createElement('strong'); points.textContent = String(player.score || 0);
    row.append(rank, name, points); list.append(row);
  });
  const allFinished = playerData.length >= 2 && playerData.every(player => player.finished);
  const unfinished = playerData.filter(player => !player.finished).length;
  $('opponentStatus').textContent = allFinished ? 'FULL TIME · FINAL STANDINGS ABOVE' : `${unfinished} PLAYER${unfinished === 1 ? '' : 'S'} STILL PLAYING`;
  if (roomData.status === 'waiting') return;
  if (allFinished) {
    $('multiQuestion').textContent = 'THE FINAL WHISTLE.';
    $('multiAnswer').disabled = true; $('multiSubmit').disabled = true;
    $('multiCounter').textContent = 'FULL TIME';
    $('opponentStatus').textContent = 'FINAL STANDINGS ABOVE';
    $('multiFinal').classList.remove('hidden');
    const bestScore = Math.max(...playerData.map(player => player.score || 0));
    const leaders = playerData.filter(player => (player.score || 0) === bestScore);
    $('multiFinal').textContent = me.score < bestScore ? 'THEY TAKE THE POINTS.' : leaders.length > 1 ? 'IT’S A TIE AT THE TOP.' : 'YOU WIN. CLASS ACT.';
    return;
  }
  if (me.finished) {
    $('multiQuestion').textContent = 'YOU’RE FULL TIME.';
    $('multiAnswer').disabled = true; $('multiSubmit').disabled = true;
    $('multiCounter').textContent = '15 / 15'; $('opponentStatus').textContent = `WAITING FOR ${unfinished} PLAYER${unfinished === 1 ? '' : 'S'} TO FINISH`;
    return;
  }
  $('multiFinal').classList.add('hidden');
  const item = roomData.questions[me.index];
  if (!item) return;
  $('multiCategory').textContent = item.cat; $('multiCounter').textContent = `${String(me.index + 1).padStart(2, '0')} / 15`;
  $('multiQuestion').textContent = item.q;
  $('multiAnswer').disabled = waitingForAdvance; $('multiSubmit').disabled = waitingForAdvance;
  $('opponentStatus').textContent = `${playerData.filter(player => player.finished).length}/${playerData.length} PLAYERS FINISHED`;
}
async function createRoom() {
  try {
    $('createRoom').disabled = $('joinRoom').disabled = true; lobbyMessage('Connecting to the match centre…'); await connect();
    let code, ref, occupied = true;
    while (occupied) { code = Array.from(crypto.getRandomValues(new Uint8Array(5)), n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join(''); ref = doc(db, 'rooms', code); occupied = (await getDoc(ref)).exists(); }
    const name = playerName();
    await setDoc(ref, { host: uid, playerIds: [uid], status: 'waiting', questions: [], createdAt: serverTimestamp() });
    await setDoc(doc(db, 'rooms', code, 'players', uid), { name, score: 0, index: 0, finished: false });
    roomId = code; myPlayer = { id: uid, name, score: 0, index: 0, finished: false }; $('roomCodeDisplay').textContent = code;
    section('multiLobby', false); section('multiWaiting', true); listenToRoom();
  } catch (error) { lobbyMessage(error.message, true); }
  finally { $('createRoom').disabled = $('joinRoom').disabled = false; }
}
async function joinRoom() {
  try {
    $('createRoom').disabled = $('joinRoom').disabled = true; lobbyMessage('Joining the room…'); await connect();
    const code = $('roomCode').value.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{5}$/.test(code)) throw new Error('Enter the five-character room code.');
    const roomRef = doc(db, 'rooms', code); let joined = false;
    await runTransaction(db, async tx => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) throw new Error('Room not found. Check the code and try again.');
      const room = snap.data();
      if (room.status !== 'waiting') throw new Error('This match has already kicked off.');
      if (room.playerIds.includes(uid)) { joined = true; return; }
      if (room.playerIds.length >= 8) throw new Error('This room is full (8 players maximum).');
      tx.update(roomRef, { playerIds: [...room.playerIds, uid] }); joined = true;
    });
    const name = playerName();
    if (!await getDoc(doc(db, 'rooms', code, 'players', uid)).then(s => s.exists())) await setDoc(doc(db, 'rooms', code, 'players', uid), { name, score: 0, index: 0, finished: false });
    roomId = code; myPlayer = { id: uid, name, score: 0, index: 0, finished: false }; $('roomCodeDisplay').textContent = code;
    section('multiLobby', false); section('multiWaiting', true); listenToRoom();
  } catch (error) { lobbyMessage(error.message, true); }
  finally { $('createRoom').disabled = $('joinRoom').disabled = false; }
}
async function kickOff() {
  try {
    if (playerData.length < 2 || playerData.length > 8 || roomData?.host !== uid) return;
    lobbyMessage('Loading the historical match archive…');
    await window.questionBankReady;
    await updateDoc(doc(db, 'rooms', roomId), { status: 'playing', questions: roundQuestions() });
  } catch (error) { lobbyMessage(error.message, true); }
}
async function submitAnswer() {
  const text = $('multiAnswer').value.trim(); if (!text || waitingForAdvance || !myPlayer || !roomData) return;
  const item = roomData.questions[myPlayer.index]; if (!item) return;
  const correct = answersMatch(text, item.a); waitingForAdvance = true;
  $('multiFeedback').textContent = correct ? `CORRECT. ${item.fact}` : `NOT QUITE. ${item.fact}`;
  $('multiFeedback').className = `feedback ${correct ? 'correct' : 'wrong'}`;
  $('multiAnswer').disabled = $('multiSubmit').disabled = true;
  try {
    const ref = doc(db, 'rooms', roomId, 'players', uid); const next = myPlayer.index + 1;
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref); const latest = snap.data();
      if (!latest || latest.index !== myPlayer.index || latest.finished) return;
      tx.update(ref, { index: next, score: (latest.score || 0) + (correct ? 1 : 0), finished: next >= 15 });
    });
  } catch (error) { $('multiFeedback').textContent = `Could not save answer: ${error.message}`; $('multiFeedback').className = 'feedback wrong'; }
  setTimeout(() => { waitingForAdvance = false; $('multiAnswer').value = ''; $('multiFeedback').textContent = ''; $('multiFeedback').className = 'feedback'; refreshMultiplayer(); if (!myPlayer.finished) $('multiAnswer').focus(); }, 1500);
}
$('onlineBtn').addEventListener('click', () => { showMultiPanel(); if (!configReady) lobbyMessage('Add Firebase config and follow the setup steps in README.md to enable online rooms.'); });
$('multiBack').addEventListener('click', () => { clearListeners(); showMultiPanel(); section('multi', false); section('intro', true); roomId = undefined; roomData = undefined; myPlayer = undefined; playerData = []; waitingForAdvance = false; });
$('createRoom').addEventListener('click', createRoom); $('joinRoom').addEventListener('click', joinRoom); $('beginMatch').addEventListener('click', kickOff);
$('multiSubmit').addEventListener('click', submitAnswer); $('multiAnswer').addEventListener('keydown', event => { if (event.key === 'Enter') submitAnswer(); });
$('copyCode').addEventListener('click', async () => { try { await navigator.clipboard.writeText(roomId); $('copyCode').textContent = 'COPIED'; setTimeout(() => $('copyCode').textContent = 'COPY CODE', 1600); } catch { $('copyCode').textContent = `CODE: ${roomId}`; } });
