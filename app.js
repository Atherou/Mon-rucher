const STORAGE_KEY = 'mon_rucher_pro';
let rucheActuelle = null, nomEnAttente = "", rangActuelIndex = null, currentZoom = 1;

window.onload = () => {
    if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify({ rangs: [] }));
    afficherRucher();
};

function sauvegarder(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

/* --- SYSTÈME DE VUE (ZOOM & PAN) --- */
function zoom(f) { 
    currentZoom *= f; 
    currentZoom = Math.min(Math.max(currentZoom, 0.3), 3); 
    document.getElementById('grille-libre').style.transform = `scale(${currentZoom})`; 
}

function recentrer() { 
    currentZoom = 1; 
    document.getElementById('grille-libre').style.transform = `scale(1)`; 
    window.scrollTo(0,0); 
}

/* --- AFFICHAGE PRINCIPAL --- */
function afficherRucher() {
    const canvas = document.getElementById('grille-libre');
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    canvas.innerHTML = "";
    let nR = 0, nRt = 0;

    data.rangs.forEach((rang, rIdx) => {
        let rangDiv = document.createElement('div');
        rangDiv.className = `rang-container rang-${rang.orientation === 'column' ? 'vertical' : 'horizontal'}`;
        rangDiv.style.left = (rang.x || 100) + "px"; 
        rangDiv.style.top = (rang.y || 150) + "px";

        let titre = document.createElement('div');
        titre.className = "rang-titre"; 
        titre.innerText = rang.nom;
        titre.style.color = rang.couleur || "#f1c40f";
        titre.onclick = (e) => { e.stopPropagation(); ouvrirEditRang(rIdx); };
        rangDiv.appendChild(titre);

        rang.ruches.forEach((ruche) => {
            if (ruche.type === 'RUCHE') nR++; else nRt++;
            let rDiv = document.createElement('div');
            rDiv.className = 'bloc-ruche';
            
            // Gestion des indicateurs visuels (Notes & Élevage)
            let note = (ruche.visites && ruche.visites.length > 0) ? ruche.visites[ruche.visites.length - 1].note : null;
            const mapColor = { 'S': '#FFD700', 'A': '#2ecc71', 'B': '#e67e22', 'C': '#e74c3c' };
            
            let icons = `<div class="status-bar-icons" style="display:flex; gap:5px; margin-top:5px;">`;
            if(note) icons += `<span style="color:${mapColor[note]}">●</span>`;
            if(ruche.elevage) icons += `<span>👑</span>`;
            icons += `</div>`;

            rDiv.innerHTML = `<span>${ruche.type}</span><b>${ruche.id}</b>${icons}`;
            rDiv.onclick = (e) => { e.stopPropagation(); ouvrirVisite(ruche.uid); };
            rangDiv.appendChild(rDiv);
        });
        canvas.appendChild(rangDiv);
        rendreElementLibre(rangDiv, rIdx);
    });
    document.getElementById('compteur-cheptel').innerText = `Ruches : ${nR} | Ruchettes : ${nRt}`;
}

/* --- GESTION DES MODALES --- */
function ouvrirVisite(uid) {
    rucheActuelle = uid;
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let ru = null; d.rangs.forEach(r => { let f = r.ruches.find(x => x.uid === uid); if(f) ru = f; });
    document.getElementById('modal-titre').innerText = ru.id;
    document.getElementById('modal-visite').style.display = 'block';
    revenirAuMenu();
}

function revenirAuMenu() { 
    masquerToutSauf('menu-choix');
}

function masquerToutSauf(id) {
    ['menu-choix', 'ecran-formulaire', 'ecran-historique', 'ecran-elevage', 'ecran-deplacement'].forEach(e => {
        let el = document.getElementById(e);
        if(el) el.style.display = (e === id) ? 'block' : 'none';
    });
}

function fermerModal() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

/* --- VISITES & HISTORIQUE --- */
function afficherFormulaire() { masquerToutSauf('ecran-formulaire'); }

function sauvegarderVisite() {
    let res = document.getElementById('cadre-reserve').value;
    let couv = document.getElementById('cadre-couvain').value;
    if (!res || !couv) return alert("Complétez les cadres !");
    
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    d.rangs.forEach(rg => {
        let ru = rg.ruches.find(x => x.uid === rucheActuelle);
        if (ru) {
            ru.visites.push({ 
                date: new Date().toLocaleDateString('fr-FR'), 
                reserves: res, couvain: couv, 
                note: document.getElementById('note-ruche').value, 
                obs: document.getElementById('notes-visite').value 
            });
        }
    });
    sauvegarder(d); afficherRucher(); fermerModal();
}

function afficherHistorique() {
    masquerToutSauf('ecran-historique');
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY)), ru = null;
    d.rangs.forEach(r => { let f = r.ruches.find(x => x.uid === rucheActuelle); if(f) ru = f; });
    
    let html = ru.visites.length ? "" : "<p>Aucune visite.</p>";
    [...ru.visites].reverse().forEach(v => {
        html += `<div class="historique-item">
            <b>${v.date}</b> - Note: ${v.note}<br>
            <small>Cuv: ${v.couvain} | Res: ${v.reserves}</small><br>
            <i>${v.obs}</i>
        </div>`;
    });
    document.getElementById('liste-historique').innerHTML = html;
}

/* --- ÉLEVAGE DE REINE --- */
function afficherElevage() {
    masquerToutSauf('ecran-elevage');
    majInterfaceElevage();
}

function demarrerCycle() {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    d.rangs.forEach(r => { 
        let ru = r.ruches.find(x => x.uid === rucheActuelle); 
        if(ru) ru.elevage = { dateDepart: new Date().toISOString() }; 
    });
    sauvegarder(d); majInterfaceElevage(); afficherRucher();
}

function stopperCycle() {
    if(confirm("Arrêter l'élevage ?")){
        let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
        d.rangs.forEach(r => { 
            let ru = r.ruches.find(x => x.uid === rucheActuelle); 
            if(ru) ru.elevage = null; 
        });
        sauvegarder(d); majInterfaceElevage(); afficherRucher();
    }
}

function majInterfaceElevage() {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY)), ru = null;
    d.rangs.forEach(r => { let f = r.ruches.find(x => x.uid === rucheActuelle); if(f) ru = f; });
    
    if (ru && ru.elevage) {
        document.getElementById('info-elevage-vide').style.display = 'none';
        document.getElementById('calendrier-actif').style.display = 'block';
        const start = new Date(ru.elevage.dateDepart);
        const etapes = [
            {j:0, t:"Greffage"}, {j:5, t:"Operculation"}, {j:10, t:"Protection"}, 
            {j:11, t:"Introduction"}, {j:13, t:"Éclosion"}, {j:21, t:"Vérif Ponte"}
        ];
        document.getElementById('liste-dates-elevage').innerHTML = etapes.map(e => {
            let dt = new Date(start); dt.setDate(start.getDate() + e.j);
            return `<div class="historique-item"><b>${dt.toLocaleDateString()}</b> : ${e.t}</div>`;
        }).join('');
    } else {
        document.getElementById('info-elevage-vide').style.display = 'block';
        document.getElementById('calendrier-actif').style.display = 'none';
    }
}

/* --- DÉPLACEMENT & MODIFS --- */
function basculerTypeRuche() {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    d.rangs.forEach(r => { 
        let ru = r.ruches.find(x => x.uid === rucheActuelle); 
        if(ru) ru.type = (ru.type === 'RUCHE' ? 'RUCHETTE' : 'RUCHE'); 
    });
    sauvegarder(d); afficherRucher(); fermerModal();
}

function modifierNomRuche() {
    let n = prompt("Nouveau nom :");
    if(n) {
        let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
        d.rangs.forEach(r => { 
            let ru = r.ruches.find(x => x.uid === rucheActuelle); 
            if(ru) ru.id = n; 
        });
        sauvegarder(d); afficherRucher(); fermerModal();
    }
}

function supprimerRucheDefinitif() {
    if(confirm("Supprimer définitivement ?")) {
        let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
        d.rangs.forEach(r => { r.ruches = r.ruches.filter(x => x.uid !== rucheActuelle); });
        sauvegarder(d); afficherRucher(); fermerModal();
    }
}

/* --- DRAG & DROP DES BLOCS --- */
function rendreElementLibre(elm, idx) {
    let isM = false;
    const move = (e) => {
        isM = true;
        let x = (e.touches ? e.touches[0].clientX : e.clientX);
        let y = (e.touches ? e.touches[0].clientY : e.clientY);
        if(!elm.dataset.startX) { elm.dataset.startX = x; elm.dataset.startY = y; return; }
        let dx = (x - elm.dataset.startX) / currentZoom;
        let dy = (y - elm.dataset.startY) / currentZoom;
        elm.style.left = (elm.offsetLeft + dx) + "px";
        elm.style.top = (elm.offsetTop + dy) + "px";
        elm.dataset.startX = x; elm.dataset.startY = y;
    };
    const stop = () => {
        document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', move); document.removeEventListener('touchend', stop);
        if(isM) {
            let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
            d.rangs[idx].x = parseInt(elm.style.left);
            d.rangs[idx].y = parseInt(elm.style.top);
            sauvegarder(d);
        }
        delete elm.dataset.startX; delete elm.dataset.startY;
    };
    elm.onmousedown = (e) => { if(e.target === elm || e.target.className === 'rang-titre') { isM=false; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop); } };
    elm.ontouchstart = (e) => { if(e.target === elm || e.target.className === 'rang-titre') { isM=false; document.addEventListener('touchmove', move, {passive:false}); document.addEventListener('touchend', stop); } };
}

/* --- GESTION DES BLOCS --- */
function ouvrirPromptRang() { document.getElementById('modal-rang').style.display = 'block'; }
function creerRang() {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    d.rangs.push({ 
        nom: document.getElementById('nom-rang-input').value || "Bloc", 
        orientation: document.getElementById('orientation-rang-input').value, 
        x: 100, y: 150, ruches: [], couleur: "#f1c40f" 
    });
    sauvegarder(d); fermerModal(); afficherRucher();
}

function ouvrirEditRang(i) {
    rangActuelIndex = i;
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let r = d.rangs[i];
    let n = prompt("Nom du bloc :", r.nom);
    if(n) {
        r.nom = n;
        sauvegarder(d); afficherRucher();
    }
}

/* --- AJOUT RUCHE --- */
function ajouterNouvelleRuche() {
    let n = prompt("Nom de la ruche :"); if(!n) return;
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!d.rangs.length) return alert("Créez un bloc d'abord");
    nomEnAttente = n;
    document.getElementById('select-rang-destination').innerHTML = d.rangs.map((r,i)=>`<option value="${i}">${r.nom}</option>`).join('');
    document.getElementById('modal-type').style.display = 'block';
}

function validerType(t) {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let i = document.getElementById('select-rang-destination').value;
    d.rangs[i].ruches.push({ uid: "r-"+Date.now(), id: nomEnAttente, type: t, visites: [], elevage: null });
    sauvegarder(d); fermerModal(); afficherRucher();
}

/* --- EXPORT / IMPORT --- */
function exporterRucher() { 
    const blob = new Blob([localStorage.getItem(STORAGE_KEY)], {type:'application/json'}); 
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); 
    a.download = `rucher_${new Date().toISOString().split('T')[0]}.json`; a.click(); 
}

function importerRucher(e) { 
    const r = new FileReader(); 
    r.onload = (ev) => { 
        if(confirm("Écraser les données actuelles ?")) {
            sauvegarder(JSON.parse(ev.target.result)); location.reload(); 
        }
    }; 
    r.readAsText(e.target.files[0]); 
}