'use strict';
// Step 1: griglia statica 15x15 con dati veri. Selezione e colori provvisori (casuali).
const SIZE = 15, CELLS = SIZE * SIZE;
const PALETTE = ['#c0392b','#2980b9','#27ae60','#f39c12','#8e44ad','#16a085','#d35400','#e84393','#7f8c8d','#2c3e50'];

const boardEl = document.getElementById('board');
const infoEl = document.getElementById('info');
const statsEl = document.getElementById('stats');
let cells = []; // {game, color}

function shuffle(a){
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

// Colorazione casuale senza colori uguali adiacenti (N/S/E/O). Con 10 colori il greedy riesce sempre.
function assignColors(){
  const col = new Array(CELLS).fill(-1);
  for(let i=0;i<CELLS;i++){
    const r=Math.floor(i/SIZE), c=i%SIZE, bad=new Set();
    if(r>0) bad.add(col[i-SIZE]);
    if(c>0) bad.add(col[i-1]);
    const ok = shuffle(PALETTE.map((_,k)=>k)).filter(k=>!bad.has(k));
    col[i]=ok[0];
  }
  return col;
}

function newMap(){
  const games = shuffle(window.GAMES.slice()).slice(0, CELLS);
  const col = assignColors();
  cells = games.map((g,i)=>({game:g,color:PALETTE[col[i]]}));
  render();
}

function render(){
  boardEl.textContent='';
  cells.forEach((cell,i)=>{
    const b=document.createElement('button');
    b.type='button'; b.className='cell'; b.style.setProperty('--c',cell.color);
    b.title=cell.game.name; b.setAttribute('role','gridcell');
    const img=document.createElement('img'); img.src=cell.game.cover; img.alt=''; img.loading='lazy';
    const s=document.createElement('span'); s.textContent=cell.game.name;
    b.append(img,s);
    b.onclick=()=>select(i,b);
    boardEl.appendChild(b);
  });
  const used=new Set(cells.map(c=>c.color)).size;
  statsEl.textContent=`${cells.length} caselle · ${used} colori`;
  infoEl.textContent='Tocca una casella per vedere il gioco.';
}

function select(i,el){
  boardEl.querySelectorAll('.sel').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
  const {game,color}=cells[i];
  infoEl.textContent='';
  const dot=document.createElement('span'); dot.className='dot'; dot.style.background=color;
  infoEl.append(dot, `#${game.n} ${game.name} — BGG ${game.id} — riga ${Math.floor(i/SIZE)+1}, colonna ${i%SIZE+1}`);
}

document.getElementById('shuffleBtn').onclick=newMap;
newMap();
