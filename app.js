const STORAGE_KEY = 'mon_rucher_pro';
let rucheActuelle = null, nomEnAttente = "", rangActuelIndex = null, currentZoom = 1;

window.onload = () => {
    if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify({ rangs: [] }));
    afficherRucher();
};

function sauvegarder(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

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

function afficherRucher() {
    const canvas = document.getElementById('grille-libre');
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    canvas.innerHTML = "";
    let nR = 0, nRt = 0;
    data.rangs.forEach(r => r.ruches.forEach(ru => { if (ru.type === 'RUCHE') nR++; else nRt++; }));
    document.getElementById('compteur-cheptel').innerText = `Ruches : ${nR} | Ruchettes : ${nRt}`;

    data.rangs.forEach((rang, rIdx) => {
        let rangDiv = document.createElement('div');
        rangDiv.className = `rang-container rang-${rang.orientation === 'column' ? 'vertical' : 'horizontal'}`;
        rangDiv.style.left = (rang.x || 0) + "px"; 
        rangDiv.style.top = (rang.y || 0) + "px";
        rangDiv.setAttribute('data-idx', rIdx);

        let titre = document.createElement('div');
        titre.className = "rang-titre"; 
        titre.innerText = rang.nom;
        titre.style.color = rang.couleur || "#f1c40f";
        titre.onclick = (e) => { e.stopPropagation(); ouvrirEditRang(rIdx); };
        rangDiv.appendChild(titre);

        rang.ruches.forEach((ruche) => {
            let rDiv = document.createElement('div');
            rDiv.className = 'bloc-ruche';
            let note = (ruche.visites && ruche.visites.length > 0) ? ruche.visites[ruche.visites.length - 1].note : null;
            const map = { 'S': '#FFD700', 'A': '#FF0000', 'B': '#27ae60', 'C': '#87CEEB' };
            
            let icons = `<div class="status-bar-icons">`;
            if(note) icons += `<span style="color:${map[note]}">❤</span>`;
            if(ruche.elevage) icons += `<span>👑</span>`;
            icons += `</div>`;

            rDiv.innerHTML = `<span>${ruche.type}</span><b>${ruche.id}</b>${icons}`;
            rDiv.onclick = (e) => { e.stopPropagation(); ouvrirVisite(ruche.uid); };
            rangDiv.appendChild(rDiv);
        });
        canvas.appendChild(rangDiv);
        rendreElementLibre(rangDiv, rIdx);
    });
}

function ouvrirPromptRang() { document.getElementById('modal-rang').style.display = 'block'; }
function fermerModal() { document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); }

function creerRang() {
    let n = document.getElementById('nom-rang-input').value || "Bloc";
    let o = document.getElementById('orientation-rang-input').value;
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    d.rangs.push({ nom: n, orientation: o, x: 100, y: 150, ruches: [], couleur: "#f1c40f" });
    sauvegarder(d); fermerModal(); afficherRucher();
}

function ouvrirVisite(uid) {
    rucheActuelle = uid;
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let ru = null; d.rangs.forEach(r => { let f = r.ruches.find(x => x.uid === uid); if(f) ru = f; });
    document.getElementById('modal-titre').innerText = ru.id;
    document.getElementById('modal-visite').style.display = 'block';
    revenirAuMenu();
}

function basculerTypeRuche() {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    d.rangs.forEach(r => { 
        let ru = r.ruches.find(x => x.uid === rucheActuelle); 
        if(ru) ru.type = (ru.type === 'RUCHE' ? 'RUCHETTE' : 'RUCHE'); 
    });
    sauvegarder(d); afficherRucher(); alert("Type modifié !");
}

function sauvegarderVisite() {
    let res = document.getElementById('cadre-reserve').value, couv = document.getElementById('cadre-couvain').value;
    if (!res || !couv) return alert("Saisir les cadres !");
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    d.rangs.forEach(rg => {
        let ru = rg.ruches.find(x => x.uid === rucheActuelle);
        if (ru) ru.visites.push({ 
            date: new Date().toLocaleDateString('fr-FR'), 
            reserves: res, 
            couvain: couv, 
            note: document.getElementById('note-ruche').value, 
            obs: document.getElementById('notes-visite').value 
        });
    });
    sauvegarder(d); afficherRucher(); fermerModal();
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
        const steps = [{j:0,t:"Greffage"},{j:5,t:"Operculation"},{j:10,t:"Protection"},{j:13,t:"Eclosion"},{j:21,t:"Ponte"}];
        document.getElementById('liste-dates-elevage').innerHTML = steps.map(s => {
            let dt = new Date(start); dt.setDate(start.getDate() + s.j);
            return `<div style="padding:5px 0;"><b>${dt.toLocaleDateString()}</b>: ${s.t}</div>`;
        }).join('');
    } else {
        document.getElementById('info-elevage-vide').style.display = 'block';
        document.getElementById('calendrier-actif').style.display = 'none';
    }
}

function rendreElementLibre(elm, idx) {
    let isM = false;
    const move = (e) => {
        isM = true; 
        let x = e.type.includes('t')?e.touches[0].clientX:e.clientX, 
            y = e.type.includes('t')?e.touches[0].clientY:e.clientY;
        if(!elm.dataset.startX){elm.dataset.startX=x; elm.dataset.startY=y; return;}
        let dx = (x-elm.dataset.startX)/currentZoom, dy = (y-elm.dataset.startY)/currentZoom;
        elm.style.left = (elm.offsetLeft+dx)+"px"; 
        elm.style.top = (elm.offsetTop+dy)+"px";
        elm.dataset.startX=x; elm.dataset.startY=y;
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
    elm.addEventListener('mousedown', (e) => { 
        if(e.target.closest('.bloc-ruche')||e.target.closest('button')||e.target.closest('.rang-titre')) return; 
        isM=false; document.addEventListener('mousemove', move); document.addEventListener('mouseup', stop); 
    });
    elm.addEventListener('touchstart', (e) => { 
        if(e.target.closest('.bloc-ruche')||e.target.closest('button')||e.target.closest('.rang-titre')) return; 
        isM=false; document.addEventListener('touchmove', move, {passive:false}); document.addEventListener('touchend', stop); 
    }, {passive:true});
}

function ajouterNouvelleRuche() {
    let n = prompt("Nom de la ruche :"); if(!n) return;
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY)); 
    if(!d.rangs.length) return alert("Créez un bloc d'abord !");
    nomEnAttente = n;
    document.getElementById('select-rang-destination').innerHTML = d.rangs.map((r,i)=>`<option value="${i}">${r.nom}</option>`).join('');
    document.getElementById('modal-type').style.display = 'block';
}

function validerType(t) {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY)), i = document.getElementById('select-rang-destination').value;
    d.rangs[i].ruches.push({ uid: "r-"+Date.now(), id: nomEnAttente, type: t, visites: [], elevage: null });
    sauvegarder(d); fermerModal(); afficherRucher();
}

function exporterRucher() { 
    const blob = new Blob([localStorage.getItem(STORAGE_KEY)], {type:'application/json'}); 
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); 
    a.download = `rucher_${new Date().toLocaleDateString()}.json`; a.click(); 
}

function importerRucher(e) { 
    const r = new FileReader(); 
    r.onload = (ev) => { 
        if(confirm("Importer et écraser les données actuelles ?")){ 
            sauvegarder(JSON.parse(ev.target.result)); 
            location.reload(); 
        }
    }; 
    r.readAsText(e.target.files[0]); 
}

function revenirAuMenu() { 
    let menu = document.getElementById('menu-choix');
    if(!document.getElementById('btn-move-trigger')) {
        let btn = document.createElement('button');
        btn.id = "btn-move-trigger";
        btn.style.background = "var(--orange)";
        btn.innerText = "🚚 Déplacer de bloc";
        btn.onclick = afficherDeplacement;
        menu.insertBefore(btn, menu.querySelector('hr'));
    }
    masquerToutSauf('menu-choix');
}

function masquerToutSauf(id) {
    const ecrans = ['menu-choix', 'ecran-formulaire', 'ecran-historique', 'ecran-elevage', 'ecran-deplacement'];
    ecrans.forEach(e => {
        const el = document.getElementById(e);
        if(el) el.style.display = (e === id) ? 'block' : 'none';
    });
}

function afficherFormulaire() { masquerToutSauf('ecran-formulaire'); }
function afficherHistorique() { masquerToutSauf('ecran-historique'); majHistorique(); }
function afficherElevage() { masquerToutSauf('ecran-elevage'); majInterfaceElevage(); }

function majHistorique() {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY)), ru = null;
    d.rangs.forEach(r => { let f = r.ruches.find(x => x.uid === rucheActuelle); if(f) ru = f; });
    let h = ru.visites.length ? "" : "Aucun historique.";
    [...ru.visites].reverse().forEach(v => { 
        h += `<div class="historique-item"><b>${v.date}</b> [Note: ${v.note}]<br>Couvain:${v.couvain} Rés:${v.reserves}<br><small>${v.obs}</small></div>`; 
    });
    document.getElementById('liste-historique').innerHTML = h;
}

function modifierNomRuche() { 
    let n = prompt("Nouveau nom :"); 
    if(n){ 
        let d = JSON.parse(localStorage.getItem(STORAGE_KEY)); 
        d.rangs.forEach(r => { 
            let ru = r.ruches.find(x => x.uid === rucheActuelle); 
            if(ru) ru.id = n; 
        }); 
        sauvegarder(d); afficherRucher(); 
        document.getElementById('modal-titre').innerText = n; 
    } 
}

function supprimerRucheDefinitif() { 
    if(confirm("Supprimer cette ruche ?")){ 
        let d = JSON.parse(localStorage.getItem(STORAGE_KEY)); 
        d.rangs.forEach(r => { r.ruches = r.ruches.filter(x => x.uid !== rucheActuelle); }); 
        sauvegarder(d); afficherRucher(); fermerModal(); 
    } 
}

function validerEditRang() { 
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY)); 
    d.rangs[rangActuelIndex].nom = document.getElementById('edit-nom-rang').value; 
    d.rangs[rangActuelIndex].couleur = document.getElementById('edit-couleur-rang').value; 
    sauvegarder(d); fermerModal(); afficherRucher(); 
}

function ouvrirEditRang(i) { 
    rangActuelIndex = i; 
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY)); 
    document.getElementById('edit-nom-rang').value = d.rangs[i].nom; 
    document.getElementById('edit-couleur-rang').value = d.rangs[i].couleur || "#f1c40f";
    document.getElementById('modal-edit-rang').style.display = 'block'; 
}

function supprimerRangActuel() { 
    if(confirm("Supprimer le bloc et toutes ses ruches ?")){ 
        let d = JSON.parse(localStorage.getItem(STORAGE_KEY)); 
        d.rangs.splice(rangActuelIndex,1); 
        sauvegarder(d); fermerModal(); afficherRucher(); 
    } 
}

function afficherDeplacement() {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(!document.getElementById('ecran-deplacement')) {
        let cont = document.createElement('div');
        cont.id = "ecran-deplacement";
        cont.innerHTML = `
            <h3>Déplacer vers quel bloc ?</h3>
            <select id="select-deplacement-rang"></select>
            <button class="btn-save" onclick="validerDeplacement()">Confirmer le déplacement</button>
            <button class="btn-cancel" onclick="revenirAuMenu()">Retour</button>
        `;
        document.querySelector('#modal-visite .modal-content').appendChild(cont);
    }
    document.getElementById('select-deplacement-rang').innerHTML = d.rangs.map((r,i)=>`<option value="${i}">${r.nom}</option>`).join('');
    masquerToutSauf('ecran-deplacement');
}

function validerDeplacement() {
    let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let nouveauRangIdx = document.getElementById('select-deplacement-rang').value;
    let rucheObj = null;
    d.rangs.forEach(r => {
        let idx = r.ruches.findIndex(x => x.uid === rucheActuelle);
        if (idx !== -1) { rucheObj = r.ruches.splice(idx, 1)[0]; }
    });
    if(rucheObj) {
        d.rangs[nouveauRangIdx].ruches.push(rucheObj);
        sauvegarder(d);
        afficherRucher();
        fermerModal();
        alert("Ruche déplacée avec succès !");
    }
}