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
let indexEditionVisite = null;

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
    data.rangs.push({ nom: nom, orientation: orientation, couleur: "#f1c40f", x: 100, y: 150, ruches: [] });
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
    if (!data) return;
    canvas.innerHTML = "";

    // --- MISE À JOUR DU COMPTEUR ---
    let nbRuches = 0;
    let nbRuchettes = 0;
    data.rangs.forEach(rang => {
        rang.ruches.forEach(ruche => {
            if (ruche.type === 'RUCHE') nbRuches++;
            else if (ruche.type === 'RUCHETTE') nbRuchettes++;
        });
    });
    const compteur = document.getElementById('compteur-cheptel');
    if (compteur) {
        compteur.innerText = `Ruches : ${nbRuches} | Ruchettes : ${nbRuchettes}`;
    }

    // --- DESSIN DU RUCHER ---
    data.rangs.forEach((rang, rIdx) => {
        let rangDiv = document.createElement('div');
        const orientationClass = (rang.orientation === 'column') ? 'vertical' : 'horizontal';
        rangDiv.className = `rang-container rang-${orientationClass}`;
        
        rangDiv.setAttribute('data-idx', rIdx);
        rangDiv.style.left = (rang.x || 0) + "px";
        rangDiv.style.top = (rang.y || 0) + "px";

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
            rDiv.setAttribute('data-type', ruche.type);

            let iconeSante = "";
            if (ruche.visites && ruche.visites.length > 0) {
                const derniereNote = ruche.visites[ruche.visites.length - 1].note;
                let couleurCoeur = "";
                switch(derniereNote) {
                    case 'S': couleurCoeur = "#FFD700"; break;
                    case 'A': couleurCoeur = "#FF0000"; break;
                    case 'B': couleurCoeur = "#27ae60"; break;
                    case 'C': couleurCoeur = "#87CEEB"; break;
                    default: couleurCoeur = "transparent";
                }
                if(couleurCoeur !== "transparent") {
                    iconeSante = `<div class="sante-coeur" style="color: ${couleurCoeur};">❤</div>`;
                }
            }

            let iconeElevage = ruche.elevage ? `<span style="position:absolute; top:5px; right:5px; font-size:1rem;">👑</span>` : "";

            rDiv.innerHTML = `
                <span>${ruche.type}</span>
                <b>${ruche.id}</b>
                ${iconeSante}
                ${iconeElevage}
            `;
            
            rDiv.onclick = (e) => { 
                e.stopPropagation(); 
                ouvrirVisite(ruche.uid); 
            };
            rangDiv.appendChild(rDiv);
        });

        canvas.appendChild(rangDiv);

        new Sortable(rangDiv, {
            group: 'ruches-shared',
            animation: 150,
            draggable: '.bloc-ruche',
            delay: 150,
            delayOnTouchOnly: true,
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
        if(data.rangs[idx]) {
            data.rangs[idx].x = parseInt(elm.style.left);
            data.rangs[idx].y = parseInt(elm.style.top);
            localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
        }
        
        delete elm.dataset.startX;
        delete elm.dataset.startY;
    };

    const startMove = (e) => {
        if (e.target.closest('.bloc-ruche') || e.target.closest('button') || e.target.closest('.rang-titre')) return;
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
    if (!nom) return;
    
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    if (!data.rangs || data.rangs.length === 0) {
        alert("Veuillez d'abord créer un rang.");
        return;
    }

    nomEnAttente = nom;
    const selectRang = document.getElementById('select-rang-destination');
    selectRang.innerHTML = ""; 
    data.rangs.forEach((rang, index) => {
        let option = document.createElement('option');
        option.value = index;
        option.text = rang.nom;
        selectRang.appendChild(option);
    });

    document.getElementById('modal-type').style.display = 'block';
}

function validerType(type) {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    const indexRangChoisi = document.getElementById('select-rang-destination').value;
    
    const nouvelleRuche = { 
        uid: "r-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
        id: nomEnAttente, 
        type: type, 
        visites: [] 
    };

    if (data.rangs[indexRangChoisi]) {
        data.rangs[indexRangChoisi].ruches.push(nouvelleRuche);
        localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
        document.getElementById('modal-type').style.display = 'none';
        afficherRucher();
    }
}

function ouvrirVisite(uid) {
    rucheActuelle = uid;
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let rucheObj = null;
    data.rangs.forEach(r => {
        let f = r.ruches.find(x => x.uid === uid);
        if(f) rucheObj = f;
    });

    if(!rucheObj) return;
    document.getElementById('modal-titre').innerText = rucheObj.id;
    document.getElementById('modal-visite').style.display = 'block';
    revenirAuMenu();
}

function fermerModal() { document.getElementById('modal-visite').style.display = 'none'; }

function revenirAuMenu() { 
    document.getElementById('menu-choix').style.display = 'block'; 
    ['ecran-formulaire', 'ecran-historique', 'ecran-elevage'].forEach(id => document.getElementById(id).style.display = 'none'); 
    indexEditionVisite = null;
    document.getElementById('cadre-reserve').value = "";
    document.getElementById('cadre-couvain').value = "";
    document.getElementById('note-ruche').value = "A";
    document.getElementById('notes-visite').value = "";
}

function afficherFormulaire() { 
    document.getElementById('menu-choix').style.display = 'none'; 
    document.getElementById('ecran-formulaire').style.display = 'block'; 
}

function sauvegarderVisite() {
    let res = document.getElementById('cadre-reserve').value;
    let couv = document.getElementById('cadre-couvain').value;
    if (!res || !couv) return alert("Veuillez remplir les cadres !");
    
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let rucheObj = null;
    data.rangs.forEach(rg => {
        let found = rg.ruches.find(x => x.uid === rucheActuelle);
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
    } else {
        rucheObj.visites.push(nouvelleVisite);
    }

    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    afficherRucher(); 
    alert("Visite enregistrée !");
    revenirAuMenu();
    fermerModal();
}

/* --- Élevage Reine --- */
function afficherElevage() {
    document.getElementById('menu-choix').style.display = 'none';
    document.getElementById('ecran-elevage').style.display = 'block';
    majInterfaceElevage();
}

function majInterfaceElevage() {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let ruche = null;
    data.rangs.forEach(r => {
        let f = r.ruches.find(x => x.uid === rucheActuelle);
        if(f) ruche = f;
    });

    if (ruche && ruche.elevage) {
        document.getElementById('info-elevage-vide').style.display = 'none';
        document.getElementById('calendrier-actif').style.display = 'block';
        genererCalendrierHTML(ruche.elevage.dateDepart);
    } else {
        document.getElementById('info-elevage-vide').style.display = 'block';
        document.getElementById('calendrier-actif').style.display = 'none';
    }
}

function demarrerCycle() {
    if(!confirm("Démarrer un cycle de reine aujourd'hui (J0) ?")) return;
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    data.rangs.forEach(r => {
        let ru = r.ruches.find(x => x.uid === rucheActuelle);
        if(ru) ru.elevage = { dateDepart: new Date().toISOString() };
    });
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    afficherRucher();
    majInterfaceElevage();
}

function stopperCycle() {
    if(!confirm("Arrêter et supprimer le calendrier ?")) return;
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    data.rangs.forEach(r => {
        let ru = r.ruches.find(x => x.uid === rucheActuelle);
        if(ru) delete ru.elevage;
    });
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    afficherRucher();
    majInterfaceElevage();
}

function genererCalendrierHTML(dateISO) {
    const depart = new Date(dateISO);
    const etapes = [
        { j: 0, txt: "Greffage / J0", desc: "Larve de moins de 24h" },
        { j: 5, txt: "Operculation", desc: "Vérification des cellules" },
        { j: 10, txt: "⚠️ Protection", desc: "Pose des bigoudis (Cellules fragiles)" },
        { j: 13, txt: "🐣 Éclosion", desc: "Naissance de la reine" },
        { j: 21, txt: "👑 Contrôle ponte", desc: "Vérifier si fécondée" }
    ];

    let html = etapes.map(e => {
        let d = new Date(depart);
        d.setDate(d.getDate() + e.j);
        const estPasse = new Date() > d;
        return `
            <div style="padding:10px; border-bottom:1px solid #444; opacity: ${estPasse ? '0.5' : '1'}">
                <b style="color:var(--primary)">${d.toLocaleDateString('fr-FR')}</b> - ${e.txt}<br>
                <small style="color:#bbb">${e.desc}</small>
            </div>
        `;
    }).join('');
    document.getElementById('liste-dates-elevage').innerHTML = html;
}

/* --- Historique --- */
function afficherHistoriqueComplet() {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro')), ru = null;
    data.rangs.forEach(rg => { 
        let f = rg.ruches.find(x => x.uid === rucheActuelle); 
        if(f) ru = f; 
    });

    if(!ru) return;
    let html = ru.visites.map((v, idx) => `
        <div style="padding:12px; border-bottom:1px solid #444;">
            <div style="color:var(--primary); font-weight:bold; margin-bottom:4px;">📅 ${v.date}</div>
            <div style="font-size:0.9rem;">🍯 Rés: ${v.reserves} | 🐝 Couv: ${v.couvain} | ⭐ Note: ${v.note}</div>
            <div style="font-style:italic; color:#bbb; font-size:0.85rem; margin-top:4px;">${v.obs || "Aucune note"}</div>
            <div style="margin-top:10px; display:flex; gap:15px;">
                <span onclick="editerVisite(${idx})" style="cursor:pointer; font-size:0.9rem; color:var(--primary);">✏️ Modifier</span>
                <span onclick="supprimerVisite(${idx})" style="cursor:pointer; font-size:0.9rem; color:#e74c3c;">🗑️ Supprimer</span>
            </div>
        </div>
    `).reverse().join('') || "<p style='text-align:center; padding:20px;'>Aucun historique.</p>";
    
    document.getElementById('liste-historique-complete').innerHTML = html;
    document.getElementById('menu-choix').style.display = 'none'; 
    document.getElementById('ecran-historique').style.display = 'block';
}

function supprimerVisite(idx) {
    if (!confirm("Supprimer cette visite ?")) return;
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    data.rangs.forEach(rg => {
        let ru = rg.ruches.find(x => x.uid === rucheActuelle);
        if (ru) ru.visites.splice(idx, 1);
    });
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    afficherHistoriqueComplet();
}

function editerVisite(idx) {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let ru = null;
    data.rangs.forEach(rg => {
        let f = rg.ruches.find(x => x.uid === rucheActuelle);
        if (f) ru = f;
    });
    let v = ru.visites[idx];
    document.getElementById('cadre-reserve').value = v.reserves;
    document.getElementById('cadre-couvain').value = v.couvain;
    document.getElementById('note-ruche').value = v.note;
    document.getElementById('notes-visite').value = v.obs;
    indexEditionVisite = idx;
    document.getElementById('ecran-historique').style.display = 'none';
    document.getElementById('ecran-formulaire').style.display = 'block';
}

/* --- Sauvegarde et Sécurité --- */
function sauvegarderNouvelOrdre() {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let dictionnaireRuches = {};
    data.rangs.forEach(r => { r.ruches.forEach(ru => { dictionnaireRuches[ru.uid] = ru; }); });

    const containers = document.querySelectorAll('.rang-container');
    let uidsTraites = new Set();

    containers.forEach(container => {
        const rIdx = parseInt(container.getAttribute('data-idx'));
        const ruchesDivs = container.querySelectorAll('.bloc-ruche');
        let nouvellesRuchesDuRang = [];
        
        ruchesDivs.forEach(div => {
            const uid = div.getAttribute('data-uid');
            let rucheObj = dictionnaireRuches[uid];
            if(rucheObj) { nouvellesRuchesDuRang.push(rucheObj); uidsTraites.add(uid); }
        });
        if(data.rangs[rIdx]) data.rangs[rIdx].ruches = nouvellesRuchesDuRang;
    });

    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
}

function modifierInfosRuche() {
    let d = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let rucheObj = null;
    d.rangs.forEach(r => {
        let f = r.ruches.find(x => x.uid === rucheActuelle);
        if(f) rucheObj = f;
    });
    let n = prompt("Nouveau nom :", rucheObj.id);
    if (n) {
        rucheObj.id = n;
        localStorage.setItem('mon_rucher_pro', JSON.stringify(d));
        afficherRucher(); 
        document.getElementById('modal-titre').innerText = n;
    }
}

function supprimerRucheDefinitif() {
    if (confirm("Supprimer cette ruche ?")) {
        let d = JSON.parse(localStorage.getItem('mon_rucher_pro'));
        d.rangs.forEach(r => { r.ruches = r.ruches.filter(x => x.uid !== rucheActuelle); });
        localStorage.setItem('mon_rucher_pro', JSON.stringify(d));
        afficherRucher(); fermerModal();
    }
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
            location.reload();
        } catch (err) { alert("Fichier invalide."); }
    };
    reader.readAsText(fichier);
}

function fermerModalType() { document.getElementById('modal-type').style.display = 'none'; }