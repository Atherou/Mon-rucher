let rucheActuelle = null;
let nomEnAttente = "";
let rangActuelIndex = null;

window.onload = () => {
    if (!localStorage.getItem('mon_rucher_pro')) {
        localStorage.setItem('mon_rucher_pro', JSON.stringify({ rangs: [] }));
    }
    afficherRucher();
};

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

/* --- Affichage et Swap --- */
function afficherRucher() {
    const canvas = document.getElementById('grille-libre');
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    canvas.innerHTML = "";

    data.rangs.forEach((rang, rIdx) => {
        let rangDiv = document.createElement('div');
        
        // CORRECTION : On applique bien 'vertical' pour 'column' et 'horizontal' pour 'row'
        const orientationClass = (rang.orientation === 'column') ? 'vertical' : 'horizontal';
        rangDiv.className = `rang-container rang-${orientationClass}`;
        
        rangDiv.style.left = rang.x + "px";
        rangDiv.style.top = rang.y + "px";

        // Gestion du drop (échange ou ajout)
        rangDiv.ondragover = (e) => { e.preventDefault(); rangDiv.classList.add('drag-over'); };
        rangDiv.ondragleave = () => rangDiv.classList.remove('drag-over');
        rangDiv.ondrop = (e) => { 
            rangDiv.classList.remove('drag-over');
            handleDropRuche(e, rIdx, null); 
        };

        // Titre (Toujours en haut et centré via CSS)
        let titre = document.createElement('div');
        titre.className = "rang-titre";
        titre.innerText = rang.nom;
        titre.style.color = rang.couleur || "#ff0000";
        titre.onclick = (e) => { e.stopPropagation(); ouvrirEditRang(rIdx); };
        rangDiv.appendChild(titre);

        // Affichage des ruches
        rang.ruches.forEach((ruche, rucheIdx) => {
            let rDiv = document.createElement('div');
            rDiv.className = 'bloc-ruche';
            rDiv.draggable = true;
            
            rDiv.ondragstart = (e) => {
                e.stopPropagation();
                e.dataTransfer.setData("rucheId", ruche.id);
                e.dataTransfer.setData("fromRang", rIdx);
                e.dataTransfer.setData("fromIdx", rucheIdx);
            };

            rDiv.ondragover = (e) => { e.preventDefault(); e.stopPropagation(); rDiv.style.transform = "scale(1.05)"; };
            rDiv.ondragleave = () => rDiv.style.transform = "scale(1)";
            rDiv.ondrop = (e) => { 
                e.preventDefault(); e.stopPropagation(); 
                rDiv.style.transform = "scale(1)";
                handleDropRuche(e, rIdx, rucheIdx); 
            };

            rDiv.innerHTML = `<span>${ruche.type}</span><b>${ruche.id}</b>`;
            rDiv.onclick = (e) => { e.stopPropagation(); ouvrirVisite(ruche.id); };
            rangDiv.appendChild(rDiv);
        });

        rendreElementLibre(rangDiv, rIdx);
        canvas.appendChild(rangDiv);
    });
}

function handleDropRuche(e, toRangIdx, toRucheIdx) {
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    let rucheId = e.dataTransfer.getData("rucheId");
    let fromRangIdx = parseInt(e.dataTransfer.getData("fromRang"));
    let fromRucheIdx = parseInt(e.dataTransfer.getData("fromIdx"));

    let [rucheMobile] = data.rangs[fromRangIdx].ruches.splice(fromRucheIdx, 1);

    if (toRucheIdx !== null) {
        data.rangs[toRangIdx].ruches.splice(toRucheIdx, 0, rucheMobile);
    } else {
        data.rangs[toRangIdx].ruches.push(rucheMobile);
    }

    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    afficherRucher();
}

function rendreElementLibre(elm, idx) {
    elm.onmousedown = (e) => {
        if (e.target.closest('.bloc-ruche')) return;
        let pos3 = e.clientX, pos4 = e.clientY;
        document.onmouseup = () => {
            document.onmouseup = null; document.onmousemove = null;
            let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
            data.rangs[idx].x = elm.offsetLeft; data.rangs[idx].y = elm.offsetTop;
            localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
        };
        document.onmousemove = (e) => {
            let pos1 = pos3 - e.clientX, pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            elm.style.top = (elm.offsetTop - pos2) + "px";
            elm.style.left = (elm.offsetLeft - pos1) + "px";
        };
    };
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
    
    // Trouver la ruche
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
        // Mode édition
        rucheObj.visites[indexEditionVisite] = nouvelleVisite;
        indexEditionVisite = null;
    } else {
        // Mode création
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

// --- VARIABLES GLOBALES ---
let indexEditionVisite = null; // Pour savoir quelle visite on modifie

function supprimerVisite(idxVisite) {
    if (!confirm("Supprimer cette visite définitivement ?")) return;
    
    let data = JSON.parse(localStorage.getItem('mon_rucher_pro'));
    data.rangs.forEach(rg => {
        let ru = rg.ruches.find(x => x.id === rucheActuelle);
        if (ru) {
            // L'historique affiché est inversé (.reverse()), il faut donc recalculer l'index réel
            let indexReel = ru.visites.length - 1 - idxVisite; 
            ru.visites.splice(indexReel, 1);
        }
    });
    
    localStorage.setItem('mon_rucher_pro', JSON.stringify(data));
    afficherHistoriqueComplet(); // Actualise l'affichage
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

    // Remplir le formulaire
    document.getElementById('cadre-reserve').value = v.reserves;
    document.getElementById('cadre-couvain').value = v.couvain;
    document.getElementById('note-ruche').value = v.note;
    document.getElementById('notes-visite').value = v.obs;

    indexEditionVisite = indexReel; // On stocke l'index pour la sauvegarde

    // Basculer vers le formulaire
    document.getElementById('ecran-historique').style.display = 'none';
    document.getElementById('ecran-formulaire').style.display = 'block';
}

// --- EXPORTATION (Envoi vers PC) ---
function exporterRucher() {
    const data = localStorage.getItem('mon_rucher_pro');
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Création d'un lien invisible pour télécharger le fichier
    const a = document.createElement('a');
    a.href = url;
    a.download = `rucher_backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert("Fichier de sauvegarde généré ! Envoie-le maintenant par mail pour le récupérer sur ton PC.");
}

// --- IMPORTATION (Récupération sur PC) ---
function importerRucher(event) {
    const fichier = event.target.files[0];
    if (!fichier) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const contenu = e.target.result;
            // On vérifie que c'est bien du JSON valide avant d'écraser
            JSON.parse(contenu); 
            localStorage.setItem('mon_rucher_pro', contenu);
            alert("Rucher synchronisé avec succès !");
            location.reload(); // Recharge la page pour afficher les nouvelles données
        } catch (err) {
            alert("Erreur : Le fichier de sauvegarde est invalide.");
        }
    };
    reader.readAsText(fichier);
}

