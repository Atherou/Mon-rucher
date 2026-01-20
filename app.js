/* --- CONFIGURATION ET CONSTANTES --- */
const STORAGE_KEY = 'mon_rucher_pro';
const BACKUP_KEY = 'mon_rucher_pro_backup';

let rucheActuelle = null; 
let nomEnAttente = "";
let rangActuelIndex = null;
let currentZoom = 1; 

window.onload = () => {
    try {
        const rawData = localStorage.getItem(STORAGE_KEY);
        if (!rawData) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ rangs: [] }));
        }
    } catch (e) { restaurerBackup(); }
    afficherRucher();
};

function sauvegarder(data) {
    try {
        const actuelle = localStorage.getItem(STORAGE_KEY);
        if (actuelle) localStorage.setItem(BACKUP_KEY, actuelle);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { alert("Erreur de stockage."); }
}

/* --- NAVIGATION --- */
function zoom(factor) {
    currentZoom *= factor;
    currentZoom = Math.min(Math.max(currentZoom, 0.3), 3);
    const canvas = document.getElementById('grille-libre');
    if (canvas) {
        canvas.style.transform = `scale(${currentZoom})`;
        canvas.style.transformOrigin = "0 0";
    }
}

function recentrer() {
    currentZoom = 1;
    const canvas = document.getElementById('grille-libre');
    if (canvas) canvas.style.transform = `scale(1)`;
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

/* --- AFFICHAGE PRINCIPAL --- */
function afficherRucher() {
    try {
        const canvas = document.getElementById('grille-libre');
        let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        canvas.innerHTML = "";

        let nR = 0, nRt = 0;
        data.rangs.forEach(r => {
            r.ruches.forEach(ru => { if (ru.type === 'RUCHE') nR++; else nRt++; });
        });
        const cpter = document.getElementById('compteur-cheptel');
        if(cpter) cpter.innerText = `Ruches : ${nR} | Ruchettes : ${nRt}`;

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
                rDiv.setAttribute('data-uid', ruche.uid);

                let couleurCoeur = "transparent";
                if (ruche.visites && ruche.visites.length > 0) {
                    const note = ruche.visites[ruche.visites.length - 1].note;
                    const map = { 'S': '#FFD700', 'A': '#FF0000', 'B': '#27ae60', 'C': '#87CEEB' };
                    couleurCoeur = map[note] || "transparent";
                }

                let htmlIcons = `<div class="status-bar-icons">`;
                if(couleurCoeur !== "transparent") htmlIcons += `<span style="color:${couleurCoeur};">❤</span>`;
                if(ruche.elevage) htmlIcons += `<span>👑</span>`;
                htmlIcons += `</div>`;

                rDiv.innerHTML = `<span>${ruche.type}</span><b>${ruche.id}</b>${htmlIcons}`;
                
                // --- SÉCURITÉ CLIC MOBILE ---
                rDiv.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ouvrirVisite(ruche.uid);
                });

                rangDiv.appendChild(rDiv);
            });

            canvas.appendChild(rangDiv);

            // SortableJS avec délai pour éviter les clics accidentels
            new Sortable(rangDiv, {
                group: 'ruches-shared',
                animation: 150,
                draggable: '.bloc-ruche',
                delay: 100, // Petit délai pour distinguer le clic du drag
                delayOnTouchOnly: true,
                onEnd: () => sauvegarderNouvelOrdre()
            });

            rendreElementLibre(rangDiv, rIdx);
        });
    } catch (e) { console.error(e); }
}

/* --- DRAG RANGS (AMÉLIORÉ MOBILE) --- */
function rendreElementLibre(elm, idx) {
    let isDragging = false;
    let startX, startY;

    const move = (e) => {
        isDragging = true; // Si on bouge, ce n'est plus un clic
        let x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let y = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        
        if (!elm.dataset.startX) { 
            elm.dataset.startX = x; 
            elm.dataset.startY = y; 
            return; 
        }

        let dx = (x - elm.dataset.startX) / currentZoom;
        let dy = (y - elm.dataset.startY) / currentZoom;

        elm.style.left = (elm.offsetLeft + dx) + "px";
        elm.style.top = (elm.offsetTop + dy) + "px";
        
        elm.dataset.startX = x; 
        elm.dataset.startY = y;
    };

    const stop = () => {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', stop);
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', stop);
        
        if (isDragging) {
            let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if(d.rangs[idx]) {
                d.rangs[idx].x = parseInt(elm.style.left);
                d.rangs[idx].y = parseInt(elm.style.top);
                sauvegarder(d);
            }
        }
        delete elm.dataset.startX;
        delete elm.dataset.startY;
    };

    // Événement Souris
    elm.addEventListener('mousedown', (e) => {
        // Si on clique sur une ruche ou un bouton, on laisse l'événement normal se faire
        if (e.target.closest('.bloc-ruche') || e.target.closest('button') || e.target.closest('.rang-titre')) return;
        isDragging = false;
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', stop);
    });

    // Événement Tactile (Mobile)
    elm.addEventListener('touchstart', (e) => {
        // Crucial : Ne pas empêcher le clic sur les ruches
        if (e.target.closest('.bloc-ruche') || e.target.closest('button') || e.target.closest('.rang-titre')) return;
        
        isDragging = false;
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('touchend', stop);
    }, { passive: true }); // "true" permet au défilement naturel de fonctionner
}

/* --- RESTE DES FONCTIONS (IDENTIQUES) --- */
function ajouterNouvelleRuche() {
    let nom = prompt("Nom :"); if (!nom) return;
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    nomEnAttente = nom;
    const sel = document.getElementById('select-rang-destination');
    sel.innerHTML = data.rangs.map((r, i) => `<option value="${i}">${r.nom}</option>`).join('');
    document.getElementById('modal-type').style.display = 'block';
}

function validerType(type) {
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let idx = document.getElementById('select-rang-destination').value;
    data.rangs[idx].ruches.push({
        uid: "r-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        id: nomEnAttente, type: type, visites: [], elevage: null
    });
    sauvegarder(data);
    document.getElementById('modal-type').style.display = 'none';
    afficherRucher();
}

function ouvrirVisite(uid) {
    rucheActuelle = uid;
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let ru = null;
    data.rangs.forEach(r => { let f = r.ruches.find(x => x.uid === uid); if(f) ru = f; });
    document.getElementById('modal-titre').innerText = ru.id;
    document.getElementById('modal-visite').style.display = 'block';
    revenirAuMenu();
}

function fermerModal() { document.getElementById('modal-visite').style.display = 'none'; }
function revenirAuMenu() {
    document.getElementById('menu-choix').style.display = 'block';
    ['ecran-formulaire', 'ecran-historique', 'ecran-elevage'].forEach(id => {
        const el = document.getElementById(id); if(el) el.style.display = 'none';
    });
}

function sauvegarderVisite() {
    let res = document.getElementById('cadre-reserve').value;
    let couv = document.getElementById('cadre-couvain').value;
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    data.rangs.forEach(rg => {
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
    sauvegarder(data);
    afficherRucher(); fermerModal();
}

function afficherElevage() {
    document.getElementById('menu-choix').style.display = 'none';
    document.getElementById('ecran-elevage').style.display = 'block';
    majInterfaceElevage();
}

function majInterfaceElevage() {
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    let ru = null;
    data.rangs.forEach(r => { let f = r.ruches.find(x => x.uid === uid); if(f) ru = f; }); // Note: correction ici pour utiliser rucheActuelle
    data.rangs.forEach(r => { let f = r.ruches.find(x => x.uid === rucheActuelle); if(f) ru = f; });
    if (ru && ru.elevage) {
        document.getElementById('info-elevage-vide').style.display = 'none';
        document.getElementById('calendrier-actif').style.display = 'block';
        genererCalendrierHTML(ru.elevage.dateDepart);
    } else {
        document.getElementById('info-elevage-vide').style.display = 'block';
        document.getElementById('calendrier-actif').style.display = 'none';
    }
}

function demarrerCycle() {
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    data.rangs.forEach(r => {
        let ru = r.ruches.find(x => x.uid === rucheActuelle);
        if(ru) ru.elevage = { dateDepart: new Date().toISOString() };
    });
    sauvegarder(data);
    majInterfaceElevage(); afficherRucher();
}

function stopperCycle() {
    if(!confirm("Arrêter l'élevage ?")) return;
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    data.rangs.forEach(r => {
        let ru = r.ruches.find(x => x.uid === rucheActuelle);
        if(ru) ru.elevage = null;
    });
    sauvegarder(data);
    majInterfaceElevage(); afficherRucher();
}

function genererCalendrierHTML(iso) {
    const d = new Date(iso);
    const etapes = [
        { j: 0, t: "Greffage" }, { j: 5, t: "Operculation" },
        { j: 10, t: "Protection" }, { j: 13, t: "Éclosion" }, { j: 21, t: "Ponte" }
    ];
    document.getElementById('liste-dates-elevage').innerHTML = etapes.map(e => {
        let dateE = new Date(d); dateE.setDate(d.getDate() + e.j);
        return `<div style="padding:10px; border-bottom:1px solid #333;"><b>${dateE.toLocaleDateString('fr-FR')}</b> - ${e.t}</div>`;
    }).join('');
}

function exporterRucher() {
    const data = localStorage.getItem(STORAGE_KEY);
    const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
    const blob = new Blob([data], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rucher_save_${date}.json`;
    a.click();
}

function importerRucher(e) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const contenu = JSON.parse(event.target.result);
            if (confirm("Remplacer les données ?")) { sauvegarder(contenu); location.reload(); }
        } catch (err) { alert("Fichier invalide."); }
    };
    reader.readAsText(e.target.files[0]);
}

function sauvegarderNouvelOrdre() {
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    document.querySelectorAll('.rang-container').forEach(cont => {
        let rIdx = cont.getAttribute('data-idx');
        let newRuches = [];
        cont.querySelectorAll('.bloc-ruche').forEach(br => {
            let uid = br.getAttribute('data-uid');
            data.rangs.forEach(r => {
                let found = r.ruches.find(x => x.uid === uid);
                if(found) newRuches.push(found);
            });
        });
        if(data.rangs[rIdx]) data.rangs[rIdx].ruches = newRuches;
    });
    sauvegarder(data);
}

function modifierNomRuche() {
    let n = prompt("Nouveau nom :");
    if(n) {
        let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
        d.rangs.forEach(r => { 
            let ru = r.ruches.find(x => x.uid === rucheActuelle);
            if(ru) ru.id = n;
        });
        sauvegarder(d);
        afficherRucher(); 
        document.getElementById('modal-titre').innerText = n;
    }
}

function supprimerRucheDefinitif() {
    if (confirm("Supprimer cette ruche ?")) {
        let d = JSON.parse(localStorage.getItem(STORAGE_KEY));
        d.rangs.forEach(r => { r.ruches = r.ruches.filter(x => x.uid !== rucheActuelle); });
        sauvegarder(d);
        afficherRucher(); fermerModal();
    }
}