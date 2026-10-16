//@target illustrator
/*
 * NettoyageDocument.jsx  —  v1.0.0
 * ----------------------------------------------------------------------------
 * FR : Nettoyage en profondeur d'un document Illustrator, en une passe :
 *      calques et sous-calques vides, groupes vides, masques d'écrêtage sans
 *      contenu, points isolés, blocs de texte vides (ou seulement des espaces),
 *      tracés sans fond ni contour, groupes inutiles à un seul objet, objets
 *      masqués. Le bouton « Analyser » compte d'abord ce qui serait supprimé,
 *      sans rien modifier ; « Nettoyer » applique.
 *      La commande native Objet > Tracé > Nettoyer ne traite ni les calques
 *      vides, ni les groupes vides, ni les masques vides, ni les groupes
 *      à un seul objet : ce script les regroupe dans un seul dialogue.
 * EN : Deep cleanup of an Illustrator document in one pass: empty layers and
 *      sublayers, empty groups, empty clipping masks, stray points, empty
 *      (or whitespace-only) text frames, unpainted paths, redundant
 *      single-item groups, hidden objects. "Analyze" counts first without
 *      changing anything; "Clean" applies.
 *
 * Cible / Target : Illustrator CC (2018+) jusqu'aux versions récentes.
 * Statut / Status : NON TESTÉ DANS ILLUSTRATOR — syntaxe ES3 vérifiée (acorn).
 *                   NOT TESTED IN ILLUSTRATOR — ES3 syntax checked (acorn).
 * Annulation / Undo : Ctrl+Z / Cmd+Z annule le nettoyage (selon la version
 *      d'Illustrator, il peut falloir plusieurs Ctrl+Z).
 *      Ctrl+Z / Cmd+Z undoes the cleanup (depending on the version, several
 *      steps may be needed).
 * Conseil : travaillez sur une copie de votre fichier.
 * Tip     : work on a copy of your file.
 * Aucune connexion réseau, aucune collecte de données.
 * No network access, no data collection.
 *
 * Licence MIT — (c) 2026 Amirouche Amwanes. Code original.
 */

(function () {

    var VERSION = "1.0.0";

    // ------------------------------------------------------------------
    // Langue de l'interface / UI language (français si Illustrator est en FR)
    // ------------------------------------------------------------------
    var FR = String($.locale || "").toLowerCase().indexOf("fr") === 0;
    function t(fr, en) { return FR ? fr : en; }

    // ------------------------------------------------------------------
    // Garde-fous / Guards
    // ------------------------------------------------------------------
    if (app.documents.length === 0) {
        alert(t("Aucun document ouvert.\nOuvrez un document puis relancez le script.",
                "No document open.\nOpen a document and run the script again."));
        return;
    }

    var doc = app.activeDocument;

    // La sélection peut être un tableau d'objets ou un TextRange (édition de texte)
    // Selection can be an array of items or a TextRange (text editing)
    function getSelectionArray() {
        var s = doc.selection;
        var out = [];
        if (!s || s.typename) { return out; }
        for (var i = 0; i < s.length; i++) { out.push(s[i]); }
        return out;
    }
    var selItems = getSelectionArray();
    var hasSelection = selItems.length > 0;

    // ------------------------------------------------------------------
    // Catégories / Categories
    // ------------------------------------------------------------------
    var CATS = [
        { key: "emptyLayers", def: true,  label: t("Calques et sous-calques vides", "Empty layers and sublayers") },
        { key: "emptyGroups", def: true,  label: t("Groupes vides", "Empty groups") },
        { key: "emptyMasks",  def: true,  label: t("Masques d'\u00e9cr\u00eatage sans contenu", "Clipping masks with no content") },
        { key: "strayPoints", def: true,  label: t("Points isol\u00e9s (trac\u00e9s d'un seul point)", "Stray points (one-point paths)") },
        { key: "emptyText",   def: true,  label: t("Blocs de texte vides ou seulement des espaces", "Empty or whitespace-only text frames") },
        { key: "unpainted",   def: false, label: t("Trac\u00e9s sans fond ni contour *", "Paths with no fill and no stroke *") },
        { key: "singleGroups",def: false, label: t("Groupes \u00e0 un seul objet (d\u00e9grouper) *", "Single-item groups (ungroup) *") },
        { key: "hiddenItems", def: false, label: t("Objets masqu\u00e9s *", "Hidden objects *") }
    ];

    function newCounts() {
        var c = {};
        for (var i = 0; i < CATS.length; i++) { c[CATS[i].key] = 0; }
        c.skipped = 0;
        return c;
    }

    // ------------------------------------------------------------------
    // Moteur de nettoyage / Cleanup engine
    // ctx.dry = true : on compte seulement (aucune modification)
    // ctx.dry = true : count only (nothing is changed)
    // Chaque fonction "process" renvoie true si l'objet est (ou serait) supprimé.
    // Each "process" function returns true if the item is (or would be) removed.
    // ------------------------------------------------------------------

    function isBlankText(s) {
        return /^[\s\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]*$/.test(String(s));
    }

    function safe(fn, fallback) {
        try { return fn(); } catch (e) { return fallback; }
    }

    // Supprime (ou compte) un objet / Remove (or count) an item
    function kill(item, cat, ctx) {
        ctx.counts[cat]++;
        if (!ctx.dry) {
            try {
                if (item.locked) { item.locked = false; }
                item.remove();
            } catch (e) {
                ctx.counts[cat]--;
                ctx.counts.skipped++;
                return false;
            }
        }
        return true;
    }

    function copyCollection(col) {
        var a = [];
        for (var i = 0; i < col.length; i++) { a.push(col[i]); }
        return a;
    }

    // Un groupe "neutre" peut être dégroupé sans changer l'aspect
    // A "plain" group can be ungrouped without changing the look
    function isPlainGroup(g) {
        if (g.clipped) { return false; }
        if (safe(function () { return g.name; }, "") !== "") { return false; }
        if (safe(function () { return g.opacity; }, 100) < 100) { return false; }
        if (safe(function () { return g.blendingMode; }, BlendModes.NORMAL) != BlendModes.NORMAL) { return false; }
        if (safe(function () { return g.isIsolated; }, false)) { return false; }
        if (safe(function () { return g.artworkKnockout; }, KnockoutState.KNOCKOUTOFF) == KnockoutState.KNOCKOUTON) { return false; }
        return true;
    }

    function processGroup(g, ctx) {
        var kids = copyCollection(g.pageItems);
        var alive = [];
        var i, k;

        // Enfants traités du dernier au premier / children processed last to first
        for (i = kids.length - 1; i >= 0; i--) {
            k = kids[i];
            if (g.clipped && safe(function () { return k.clipping; }, false)) {
                continue; // le trac\u00e9 de masque n'est jamais supprim\u00e9 seul / never remove the clip path alone
            }
            if (g.clipped && k.typename === "CompoundPathItem" && safe(function () { return k.pathItems.length > 0 && k.pathItems[0].clipping; }, false)) {
                continue; // masque en trac\u00e9 transparent compos\u00e9 / compound clip path
            }
            if (!processItem(k, ctx)) { alive.push(k); }
        }

        if (alive.length === 0) {
            if (g.clipped) {
                if (ctx.opts.emptyMasks) { return kill(g, "emptyMasks", ctx); }
            } else if (ctx.opts.emptyGroups) {
                return kill(g, "emptyGroups", ctx);
            }
            return false;
        }

        if (alive.length === 1 && ctx.opts.singleGroups && isPlainGroup(g)) {
            ctx.counts.singleGroups++;
            if (!ctx.dry) {
                try {
                    alive[0].move(g, ElementPlacement.PLACEBEFORE);
                    g.remove();
                } catch (e) {
                    ctx.counts.singleGroups--;
                    ctx.counts.skipped++;
                }
            }
            // Le groupe disparaît mais son contenu reste : on renvoie false
            // The group goes away but its content stays: return false
            return false;
        }
        return false;
    }

    function processItem(item, ctx) {
        var o = ctx.opts;
        var locked = safe(function () { return item.locked; }, false);
        var hidden = safe(function () { return item.hidden; }, false);

        if (locked && !o.includeLocked) { ctx.counts.skipped++; return false; }

        if (hidden) {
            if (o.hiddenItems) { return kill(item, "hiddenItems", ctx); }
            if (!o.includeLocked) { ctx.counts.skipped++; return false; }
        }

        var type = item.typename;

        if (type === "GroupItem") {
            // Déverrouiller / afficher temporairement pour pouvoir modifier le contenu
            // Temporarily unlock / show so the content can be edited
            var restoreLock = false, restoreHide = false, removed;
            if (!ctx.dry) {
                if (locked) { try { item.locked = false; restoreLock = true; } catch (e1) {} }
                if (hidden) { try { item.hidden = false; restoreHide = true; } catch (e2) {} }
            }
            removed = processGroup(item, ctx);
            if (!removed) {
                // Si le groupe a été dégroupé, item n'existe plus : try/catch
                // If the group was ungrouped, item no longer exists: try/catch
                try { if (restoreHide) { item.hidden = true; } } catch (e3) {}
                try { if (restoreLock) { item.locked = true; } } catch (e4) {}
            }
            return removed;
        }

        if (type === "CompoundPathItem") {
            if (safe(function () { return item.pathItems.length; }, 1) === 0 && o.emptyGroups) {
                return kill(item, "emptyGroups", ctx);
            }
            return false;
        }

        if (type === "PathItem") {
            var isGuide = safe(function () { return item.guides; }, false);
            var isClip = safe(function () { return item.clipping; }, false);
            if (isGuide || isClip) { return false; }
            if (o.strayPoints && safe(function () { return item.pathPoints.length; }, 2) === 1) {
                return kill(item, "strayPoints", ctx);
            }
            if (o.unpainted && !safe(function () { return item.filled; }, true) && !safe(function () { return item.stroked; }, true)) {
                return kill(item, "unpainted", ctx);
            }
            return false;
        }

        if (type === "TextFrame") {
            if (!o.emptyText) { return false; }
            // Ne pas toucher aux blocs chaînés (le texte pourrait s'y déverser)
            // Skip threaded frames (text may flow into them)
            var isPoint = safe(function () { return item.kind == TextType.POINTTEXT; }, false);
            var threaded = !isPoint && safe(function () { return !!(item.nextFrame || item.previousFrame); }, false);
            if (threaded) { return false; }
            if (isBlankText(safe(function () { return item.contents; }, "x"))) {
                return kill(item, "emptyText", ctx);
            }
            return false;
        }

        // Symboles, images, objets de plug-in, etc. : jamais touchés
        // Symbols, images, plugin items, etc.: never touched
        return false;
    }

    function processLayer(layer, ctx) {
        var o = ctx.opts;
        var wasLocked = safe(function () { return layer.locked; }, false);
        var wasHidden = !safe(function () { return layer.visible; }, true);
        var i, removed;

        if ((wasLocked || wasHidden) && !o.includeLocked) { ctx.counts.skipped++; return false; }

        if (!ctx.dry) {
            try { if (wasHidden) { layer.visible = true; } } catch (e1) {}
            try { if (wasLocked) { layer.locked = false; } } catch (e2) {}
        }

        var alive = 0;
        var subs = copyCollection(layer.layers);
        for (i = subs.length - 1; i >= 0; i--) {
            if (!processLayer(subs[i], ctx)) { alive++; }
        }
        var items = copyCollection(layer.pageItems);
        for (i = items.length - 1; i >= 0; i--) {
            if (!processItem(items[i], ctx)) { alive++; }
        }

        removed = false;
        if (alive === 0 && o.emptyLayers) {
            var isTop = (layer.parent.typename === "Document");
            if (!isTop || ctx.topAlive > 1) {
                ctx.counts.emptyLayers++;
                if (ctx.dry) {
                    removed = true;
                } else {
                    try { layer.remove(); removed = true; }
                    catch (e3) { ctx.counts.emptyLayers--; ctx.counts.skipped++; }
                }
                if (removed && isTop) { ctx.topAlive--; }
            }
        }

        if (!removed && !ctx.dry) {
            try { if (wasLocked) { layer.locked = true; } } catch (e4) {}
            try { if (wasHidden) { layer.visible = false; } } catch (e5) {}
        }
        return removed;
    }

    function run(opts, dry) {
        var ctx = { opts: opts, dry: dry, counts: newCounts(), topAlive: doc.layers.length };
        var i;
        if (opts.scope === "selection") {
            var items = getSelectionArray();
            if (!dry) { doc.selection = null; }
            for (i = items.length - 1; i >= 0; i--) { processItem(items[i], ctx); }
        } else {
            var layers = copyCollection(doc.layers);
            for (i = layers.length - 1; i >= 0; i--) { processLayer(layers[i], ctx); }
        }
        return ctx.counts;
    }

    function report(counts, dry, opts) {
        var lines = [], total = 0, i, c;
        for (i = 0; i < CATS.length; i++) {
            c = CATS[i];
            if (!opts[c.key]) { continue; }
            if (opts.scope === "selection" && c.key === "emptyLayers") { continue; }
            total += counts[c.key];
            lines.push(c.label.replace(/ \*$/, "") + " : " + counts[c.key]);
        }
        var head = dry
            ? t("Analyse (rien n'a \u00e9t\u00e9 modifi\u00e9) \u2014 \u00e0 supprimer : ", "Analysis (nothing changed) \u2014 to remove: ") + total
            : t("Nettoyage termin\u00e9 \u2014 \u00e9l\u00e9ments trait\u00e9s : ", "Cleanup done \u2014 items processed: ") + total;
        var tail = counts.skipped > 0
            ? "\n" + t("Ignor\u00e9s (verrouill\u00e9s, masqu\u00e9s ou impossibles) : ", "Skipped (locked, hidden or not possible): ") + counts.skipped
            : "";
        return head + "\n\n" + lines.join("\n") + tail;
    }

    // ------------------------------------------------------------------
    // Dialogue / Dialog (ScriptUI)
    // ------------------------------------------------------------------
    var w = new Window("dialog", t("Nettoyage du document", "Document cleanup") + " v" + VERSION);
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];

    var pScope = w.add("panel", undefined, t("Port\u00e9e", "Scope"));
    pScope.orientation = "row";
    pScope.alignChildren = ["left", "center"];
    pScope.margins = [12, 16, 12, 10];
    var rbDoc = pScope.add("radiobutton", undefined, t("Document entier", "Whole document"));
    var rbSel = pScope.add("radiobutton", undefined, t("S\u00e9lection uniquement", "Selection only"));
    rbDoc.value = true;
    if (!hasSelection) {
        rbSel.text += t(" (rien n'est s\u00e9lectionn\u00e9)", " (nothing selected)");
        rbSel.enabled = false;
    }

    var pCats = w.add("panel", undefined, t("Supprimer", "Remove"));
    pCats.orientation = "column";
    pCats.alignChildren = ["left", "top"];
    pCats.margins = [12, 16, 12, 10];
    var boxes = {};
    for (var ci = 0; ci < CATS.length; ci++) {
        boxes[CATS[ci].key] = pCats.add("checkbox", undefined, CATS[ci].label);
        boxes[CATS[ci].key].value = CATS[ci].def;
    }
    var note = pCats.add("statictext", undefined,
        t("* \u00c0 v\u00e9rifier : un trac\u00e9 peut tirer son aspect d'un style graphique ou d'effets ; seuls les groupes sans nom, opacit\u00e9 100 % et mode Normal sont d\u00e9group\u00e9s.",
          "* Check first: a path may get its look from a graphic style or effects; only unnamed groups at 100% opacity and Normal mode are ungrouped."),
        { multiline: true });
    note.preferredSize = [400, 46];

    var pOpt = w.add("panel", undefined, t("Options", "Options"));
    pOpt.orientation = "column";
    pOpt.alignChildren = ["left", "top"];
    pOpt.margins = [12, 16, 12, 10];
    var cbLocked = pOpt.add("checkbox", undefined, t("Inclure les calques et objets verrouill\u00e9s ou masqu\u00e9s", "Include locked or hidden layers and objects"));
    cbLocked.value = false;

    var result = w.add("statictext", undefined,
        t("Cliquez sur \u00ab Analyser \u00bb pour compter sans rien modifier.\nConseil : travaillez sur une copie du fichier.",
          "Click \"Analyze\" to count without changing anything.\nTip: work on a copy of your file."),
        { multiline: true });
    result.preferredSize = [400, 150];

    var gBtn = w.add("group");
    gBtn.alignment = ["right", "top"];
    var bAnalyze = gBtn.add("button", undefined, t("Analyser", "Analyze"));
    var bCancel = gBtn.add("button", undefined, t("Annuler", "Cancel"), { name: "cancel" });
    var bClean = gBtn.add("button", undefined, t("Nettoyer", "Clean"), { name: "ok" });

    function readOpts() {
        var o = { scope: rbSel.value ? "selection" : "document", includeLocked: cbLocked.value };
        var any = false;
        for (var i = 0; i < CATS.length; i++) {
            o[CATS[i].key] = boxes[CATS[i].key].value;
            if (o[CATS[i].key] && !(o.scope === "selection" && CATS[i].key === "emptyLayers")) { any = true; }
        }
        o.any = any;
        return o;
    }

    bAnalyze.onClick = function () {
        var o = readOpts();
        if (!o.any) { result.text = t("Cochez au moins une cat\u00e9gorie.", "Tick at least one category."); return; }
        try {
            result.text = report(run(o, true), true, o);
        } catch (e) {
            result.text = t("Erreur pendant l'analyse : ", "Error during analysis: ") + e.message;
        }
    };

    bClean.onClick = function () {
        var o = readOpts();
        if (!o.any) { result.text = t("Cochez au moins une cat\u00e9gorie.", "Tick at least one category."); return; }
        if (o.scope === "selection" && getSelectionArray().length === 0) {
            alert(t("Rien n'est s\u00e9lectionn\u00e9.\nS\u00e9lectionnez des objets ou choisissez \u00ab Document entier \u00bb.",
                    "Nothing is selected.\nSelect objects or choose \"Whole document\"."));
            return;
        }
        w.close(1);
    };

    if (w.show() !== 1) { return; }

    // ------------------------------------------------------------------
    // Nettoyage réel / Actual cleanup
    // ------------------------------------------------------------------
    var opts = readOpts();
    try {
        var counts = run(opts, false);
        app.redraw();
        alert(report(counts, false, opts) + "\n\n" +
              t("Ctrl+Z / Cmd+Z pour annuler.", "Ctrl+Z / Cmd+Z to undo."));
    } catch (err) {
        alert(t("Erreur pendant le nettoyage : ", "Error during cleanup: ") + err.message +
              (err.line ? " (ligne/line " + err.line + ")" : "") + "\n" +
              t("Utilisez Ctrl+Z / Cmd+Z pour revenir en arri\u00e8re.", "Use Ctrl+Z / Cmd+Z to go back."));
    }

}());
