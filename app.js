if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker enregistré !'))
            .catch(err => console.log('Erreur SW:', err));
    });
}

let rucheActuelle = null;
let nomEnAttente = "";
let rangActuelIndex = null;
let currentZoom = 1; 

window.onload = () => {
    if (!localStorage.getItem('mon_rucher_pro')) {
        localStorage.setItem('mon_rucher_pro', JSON.stringify({ rangs: [] }));
    }
    afficherRucher();
};

/* --- Navigation & Zoom --- */
function zoom(factor) {
    currentZoom *= factor;
    if (currentZoom < 0.3) currentZoom = 0.3;
    if (currentZoom > 3) currentZoom = 3;
    const canvas = document.getElementById('grille-libre');
    canvas.style.transform = `scale(${currentZoom})`;
    canvas.style.transformOrigin = "0 0";
}

function recentrer() {
    currentZoom = 1;
    const canvas = document.getElementById('grille-libre');
    canvas.style.transform = `scale(1)`;
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

/* --- Rangs --- */
function ouvrirPromptRang() { document.getElementById('modal-rang').style.display = 'block'; }
function fermerModalRang() { document.getElementById('modal-rang').style.display = 'none'; }

function creerRang() {
    let nom = document.getElementById('nom-rang-input').value || "Rang";
    let orientation = document.getElementById('orientation-rang-input').value;
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    data.rangs.push({ nom: nom, orientation: orientation, couleur: "#ff0000", x: 100, y: 150, ruches: [] });
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    fermerModalRang();
    afficherRucher();
}

function ouvrirEditRang(idx) {
    rangActuelIndex = idx;
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    document.getElementById('edit-nom-rang').value = data.rangs[idx].nom;
    document.getElementById('edit-couleur-rang').value = data.rangs[idx].couleur;
    document.getElementById('modal-edit-rang').style.display = 'block';
}

function fermerModalEditRang() { document.getElementById('modal-edit-rang').style.display = 'none'; }

function validerEditRang() {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    data.rangs[rangActuelIndex].nom = document.getElementById('edit-nom-rang').value;
    data.rangs[rangActuelIndex].couleur = document.getElementById('edit-couleur-rang').value;
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    fermerModalEditRang();
    afficherRucher();
}

function supprimerRangActuel() {
    if(!confirm("Supprimer ce rang et ses ruches ?")) return;
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    data.rangs.splice(rangActuelIndex, 1);
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    fermerModalEditRang();
    afficherRucher();
}

/* --- Affichage --- */
function afficherRucher() {
    const canvas = document.getElementById('grille-libre');
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    canvas.innerHTML = "";

    data.rangs.forEach((rang, rIdx) => {
        let rangDiv = document.createElement('div');
        const orientationClass = (rang.orientation === 'column') ? 'vertical' : 'horizontal';
        rangDiv.className = `rang-container rang-${orientationClass}`;
        
        rangDiv.setAttribute('data-idx', rIdx);
        rangDiv.style.left = rang.x + "px";
        rangDiv.style.top = rang.y + "px";

        let titre = document.createElement('div');
        titre.className = "rang-titre";
        titre.innerText = rang.nom;
        titre.style.color = rang.couleur || "#f1c40f";
        titre.onclick = (e) => { e.stopPropagation(); ouvrirEditRang(rIdx); };
        rangDiv.appendChild(titre);

        rang.ruches.forEach((ruche) => {
            let rDiv = document.createElement('div');
            rDiv.className = 'bloc-ruche';
            rDiv.innerHTML = `<span>${ruche.type}</span><b>${ruche.id}</b>`;
            // Suppression du onclick ici pour éviter les conflits, on utilisera un EventListener plus bas
            rDiv.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                ouvrirVisite(ruche.id); 
            });
            rangDiv.appendChild(rDiv);
        });

        canvas.appendChild(rangDiv);

        // CONFIGURATION SORTABLE DES RUCHES
        new Sortable(rangDiv, {
            group: 'ruches-shared',
            animation: 150,
            draggable: '.bloc-ruche',
            delay: 150,             // Délai pour mobile
            delayOnTouchOnly: true, // Désactivé sur PC
            ghostClass: 'sortable-ghost', 
            onEnd: () => sauvegarderNouvelOrdre()
        });

        rendreElementLibre(rangDiv, rIdx);
    });
}

function rendreElementLibre(elm, idx) {
    const handleMove = (e) => {
        let clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        let clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        if (!elm.dataset.startX) {
            elm.dataset.startX = clientX;
            elm.dataset.startY = clientY;
            return;
        }

        let deltaX = (clientX - elm.dataset.startX) / currentZoom;
        let deltaY = (clientY - elm.dataset.startY) / currentZoom;

        elm.style.left = (elm.offsetLeft + deltaX) + "px";
        elm.style.top = (elm.offsetTop + deltaY) + "px";

        elm.dataset.startX = clientX;
        elm.dataset.startY = clientY;
    };

    const stopMove = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', stopMove);
        document.removeEventListener('touchmove', handleMove);
        document.removeEventListener('touchend', stopMove);
        
        let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
        data.rangs[idx].x = elm.offsetLeft;
        data.rangs[idx].y = elm.offsetTop;
        localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
        
        delete elm.dataset.startX;
        delete elm.dataset.startY;
    };

    const startMove = (e) => {
        // Sécurité : on ne déplace le rang QUE si on clique sur le fond du rang ou le titre
        // Mais PAS sur une ruche ou un bouton
        if (e.target.closest('.bloc-ruche') || e.target.closest('button')) return;
        
        if (e.type === 'touchstart') e.stopPropagation(); 

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', stopMove);
        document.addEventListener('touchmove', handleMove, { passive: false });
        document.addEventListener('touchend', stopMove);
    };

    elm.addEventListener('mousedown', startMove);
    elm.addEventListener('touchstart', startMove, { passive: false });
}

/* --- Ruches --- */
function ajouterNouvelleRuche() {
    let nom = prompt("Nom de la ruche :");
    if (nom) { nomEnAttente = nom; document.getElementById('modal-type').style.display = 'block'; }
}

function validerType(type) {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    if (data.rangs.length === 0) { alert("Créez un rang d'abord !"); return; }
    data.rangs[0].ruches.push({ id: nomEnAttente, type: type, visites: [] });
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    document.getElementById('modal-type').style.display = 'none';
    afficherRucher();
}

function ouvrirVisite(id) {
    rucheActuelle = id;
    document.getElementById('modal-titre').innerText = id;
    document.getElementById('modal-visite').style.display = 'block';
    revenirAuMenu();
}

function fermerModal() { document.getElementById('modal-visite').style.display = 'none'; }
function modifierInfosRuche() {
    let n = prompt("Nouveau nom :", rucheActuelle);
    if (n) {
        let d = JSON.parse(localStorage.getItem('mon_rucher_pro'));
        d.rangs.forEach(r => { let ru = r.ruches.find(x => x.id === rucheActuelle); if(ru) ru.id = n; });
        localStorage.setItem('mon_rucher_pro', JSON.stringify(d));
        rucheActuelle = n; afficherRucher(); fermerModal();
    }
}
function supprimerRucheDefinitif() {
    if (confirm("Supprimer ?")) {
        let d = JSON.parse(localStorage.getItem('mon_rucher_pro'));
        d.rangs.forEach(r => { r.ruches = r.ruches.filter(x => x.id !== rucheActuelle); });
        localStorage.setItem('mon_rucher_pro', JSON.stringify(d));
        afficherRucher(); fermerModal();
    }
}
function revenirAuMenu() { 
    document.getElementById('menu-choix').style.display = 'block'; 
    ['ecran-formulaire', 'ecran-historique'].forEach(id => document.getElementById(id).style.display = 'none'); 
}
function afficherFormulaire() { document.getElementById('menu-choix').style.display = 'none'; document.getElementById('ecran-formulaire').style.display = 'block'; }
function fermerModalType() { document.getElementById('modal-type').style.display = 'none'; }

function sauvegarderVisite() {
    let res = document.getElementById('cadre-reserve').value;
    let couv = document.getElementById('cadre-couvain').value;
    if (!res || !couv) return alert("Veuillez remplir les cadres !");
    
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let rucheObj = null;
    
    data.rangs.forEach(rg => {
        let found = rg.ruches.find(x => x.id === rucheActuelle);
        if (found) rucheObj = found;
    });

    const nouvelleVisite = {
        date: indexEditionVisite !== null ? rucheObj.visites[indexEditionVisite].date : new Date().toLocaleDateString('fr-FR'),
        reserves: res,
        couvain: couv,
        note: document.getElementById('note-ruche').value,
        obs: document.getElementById('notes-visite').value
    };

    if (indexEditionVisite !== null) {
        rucheObj.visites[indexEditionVisite] = nouvelleVisite;
        indexEditionVisite = null;
    } else {
        rucheObj.visites.push(nouvelleVisite);
    }

    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    fermerModal();
    alert("Visite enregistrée !");
}

function afficherHistoriqueComplet() {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro')), ru = null;
    data.rangs.forEach(rg => { 
        let f = rg.ruches.find(x => x.id === rucheActuelle); 
        if(f) ru = f; 
    });

    let html = ru.visites.map((v, idx) => `
        <div style="padding:12px; border-bottom:1px solid #444; position:relative;">
            <div style="color:var(--primary); font-weight:bold; margin-bottom:4px;">📅 ${v.date}</div>
            <div style="font-size:0.9rem;">🍯 Rés: ${v.reserves} | 🐝 Couv: ${v.couvain} | ⭐ Note: ${v.note}</div>
            <div style="font-style:italic; color:#bbb; font-size:0.85rem; margin-top:4px;">${v.obs || "Aucune note"}</div>
            <div style="margin-top:10px; display:flex; gap:15px;">
                <span onclick="editerVisite(${idx})" style="cursor:pointer; font-size:0.9rem;">✏️ Modifier</span>
                <span onclick="supprimerVisite(${idx})" style="cursor:pointer; font-size:0.9rem; color:#e74c3c;">🗑️ Supprimer</span>
            </div>
        </div>
    `).reverse().join('') || "<p style='text-align:center'>Aucun historique.</p>";
    
    document.getElementById('liste-historique-complete').innerHTML = html;
    document.getElementById('menu-choix').style.display = 'none'; 
    document.getElementById('ecran-historique').style.display = 'block';
}

let indexEditionVisite = null;

function supprimerVisite(idxVisite) {
    if (!confirm("Supprimer cette visite définitivement ?")) return;
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    data.rangs.forEach(rg => {
        let ru = rg.ruches.find(x => x.id === rucheActuelle);
        if (ru) {
            let indexReel = ru.visites.length - 1 - idxVisite; 
            ru.visites.splice(indexReel, 1);
        }
    });
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    afficherHistoriqueComplet();
}

function editerVisite(idxVisite) {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let ru = null;
    data.rangs.forEach(rg => {
        let f = rg.ruches.find(x => x.id === rucheActuelle);
        if (f) ru = f;
    });

    let indexReel = ru.visites.length - 1 - idxVisite;
    let v = ru.visites[indexReel];

    document.getElementById('cadre-reserve').value = v.reserves;
    document.getElementById('cadre-couvain').value = v.couvain;
    document.getElementById('note-ruche').value = v.note;
    document.getElementById('notes-visite').value = v.obs;

    indexEditionVisite = indexReel;
    document.getElementById('ecran-historique').style.display = 'none';
    document.getElementById('ecran-formulaire').style.display = 'block';
}

function exporterRucher() {
    const data = localStorage.getItem('mon_rucher_pro');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rucher_backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("Fichier de sauvegarde généré !");
}

function importerRucher(event) {
    const fichier = event.target.files[0];
    if (!fichier) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const contenu = e.target.result;
            JSON.parse(contenu); 
            localStorage.setItem('mon_rucher_pro', contenu);
            alert("Rucher synchronisé !");
            location.reload();
        } catch (err) { alert("Fichier invalide."); }
    };
    reader.readAsText(fichier);
}

function sauvegarderNouvelOrdre() {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    const containers = document.querySelectorAll('.rang-container');

    containers.forEach(container => {
        const rIdx = container.getAttribute('data-idx');
        const ruchesDivs = container.querySelectorAll('.bloc-ruche');
        let nouvellesRuches = [];
        
        ruchesDivs.forEach(div => {
            const idRuche = div.querySelector('b').innerText;
            let rucheObj = null;
            data.rangs.forEach(r => {
                let found = r.ruches.find(ru => ru.id == idRuche);
                if(found) rucheObj = found;
            });
            if(rucheObj) nouvellesRuches.push(rucheObj);
        });
        data.rangs[rIdx].ruches = nouvellesRuches;
    });
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
}