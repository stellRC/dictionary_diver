// Pointer events are turned off in the HTML to prevent
// errors before JS is loaded. JS is defered until DOM
// is fully rendered. Once the JS loads it turns pointer
// events back on.
document.body.style.pointerEvents = "auto";
if (document.getElementById("loading") != null) {
  document.getElementById("loading").remove();
}

// Handle input from the Analyze/Define buttons on main screen
async function main_text_request(req) {
  let container = document.getElementById("input-container");
  let text = document.getElementById("main-text-input").value;
  if (req == "parse") {
    container.classList.toggle("is-offscreen");
    const response = await fetch("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "text-in": text,
      }),
    });
    const json = await response.json();
    document.querySelector(".dictionary-display").innerHTML = "";
    document.getElementById("jj0").innerHTML = json.analyzed_text;
  } else {
    document.querySelector(".dictionary-display").innerHTML = "";
    document.getElementById("jj0").innerHTML = "";
    search_jj(text, "", "define", "", "0");
  }
}

// Opens Dictionary input tab
function show_diver() {
  let container = document.getElementById("input-container");
  container.classList.toggle("is-offscreen");
}

// Closes dropdown menu when clicking anywhere else on the screen
window.onclick = (e) => {
  if (
    e.target.classList.contains("known-word") ||
    e.target.classList.contains("unknown-word") ||
    e.target.classList.contains("in-deck-word")
  ) {
    return;
  } else if (document.querySelector(".show") != null) {
    let word = document.querySelector(".show").dataset.word;
    let id = document.querySelector(".show").previousElementSibling.id;
    highlight(word, id, "click_off");
    document.querySelector(".show").classList.remove("show");
  }
};

// Dropdown menu handler
function dropdown(word, id_menu, id_text) {
  let word_menu = document.getElementById(`${id_menu}`);

  // If .show is present on the word I'm currently clicking, hlt_off & .show remove
  // Return
  if (word_menu.matches(".show")) {
    word_menu.classList.remove("show");
    highlight(word, id_text, "click_off");
    return;
  }

  // If, .show present anywhere else
  // Get word & id for that element
  // hlt_off other word
  // .show remove other word
  if (document.querySelector(".show") != null) {
    let other_id = document.querySelector(".show").previousElementSibling.id;
    let other_word = document.querySelector(".show").dataset.word;
    highlight(other_word, other_id, "click_off");
    document.querySelector(".show").classList.remove("show");
  }

  // hlt_on for current word
  // .show add for current word
  highlight(word, id_text, "click_on");
  word_menu.classList.add("show");
}

// Close dropdowns
function closeup(id, word) {
  document.getElementById(`${id}`).classList.remove("show");
  highlight(word, id, "click_off");
}

// Mark known & vice versa
async function swap_word(word, from) {
  const response = await fetch("/swap_word", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      word: word,
      type: from,
    }),
  });
  const json = await response.json();

  // Create menu for newly known words
  if (from == "unknown" || from == "in-deck-to-known") {
    document.querySelectorAll(`[data-word='${word}']`).forEach((e) => {
      e.parentElement.classList.remove(...e.parentElement.classList);
      e.parentElement.classList.add("known");
      e.previousElementSibling.classList.remove(
        ...e.previousElementSibling.classList,
      );
      e.previousElementSibling.classList.add("known-word");
      e.previousElementSibling.onclick = () => {
        dropdown(`${e.id}`, "known");
      };
      e.previousElementSibling.onmouseover = "";
      e.previousElementSibling.onmouseout = "";

      e.innerHTML = `
                    <span class="close" onclick="closeup('${e.id}')">&times;</span>
                    <button onclick="swap_word('${word}', 'known'); closeup('${e.id}')">Mark Unknown</button>
                    <button onclick="search_jj('${word}', '${e.previousElementSibling.id}', 'null', 'in-deck', '${e.parentElement.parentElement.dataset.divdepth}'); closeup('${e.id}')">Japanese Lookup</button>
                    <button onclick="search_ej('${word}', '${e.previousElementSibling.id}', 'null', 'in-deck', '${e.parentElement.parentElement.dataset.divdepth}'); closeup('${e.id}')">English Lookup</button>
                            `;
    });
  } else {
    // Create menu for newly unknown words
    document.querySelectorAll(`[data-word='${word}']`).forEach((e) => {
      // e.parentElement.classList.replace("known", "unknown");
      e.parentElement.classList.remove(...e.parentElement.classList);
      e.parentElement.classList.add("unknown");
      // e.previousElementSibling.classList.replace("known-word", "unknown-word");
      e.previousElementSibling.classList.remove(
        ...e.previousElementSibling.classList,
      );
      e.previousElementSibling.classList.add("unknown-word");
      e.previousElementSibling.onclick = () => {
        dropdown(`${e.id}`, `${e.previousElementSibling.id}`);
      };
      e.previousElementSibling.onmouseover = () => {
        highlight(`${word}`, `${e.previousElementSibling.id}`, "hover_on");
      };
      e.previousElementSibling.onmouseout = () => {
        highlight(`${word}`, `${e.previousElementSibling.id}`, "hover_off");
      };

      e.innerHTML = `
                <span class="close" onclick="closeup('${e.id}', '${word}')">&times;</span>
                <button onclick="swap_word('${word}', 'unknown'); closeup('${e.id}', '${word}')">Mark Known</button>
                <button onclick="search_jj('${word}', '${e.previousElementSibling.id}', 'null', 'null', '${e.parentElement.parentElement.dataset.divdepth}'); closeup('${e.id}', '${word}')">Japanese Lookup</button>
                <button onclick="search_ej('${word}', '${e.previousElementSibling.id}', 'null', 'null', '${e.parentElement.parentElement.dataset.divdepth}'); closeup('${e.id}', '${word}')">English Lookup</button>
                `;
    });
  }
}

// Search JJ dictionary
async function search_jj(word, id, req_type, deck, click_depth) {
  let dive = 0;
  // If we're just switching dictionaries, we're not diving, so dive=0;
  if (req_type != "switch") {
    dive = 1;
    // if (deck != "in-deck" && req_type != 'define') {
    //     highlight(word, id, 0, 'on')
    // };
  }
  const response = await fetch("/get_jj", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      def: word,
      dive: dive,
      click_depth: click_depth,
      req_type: req_type,
    }),
  });
  // json format: {"def": jj_def_analyzed, "depth": depth, "searched":searched, "cards_added": cards_added}
  const json = await response.json();

  if (document.getElementById("user-def-container") != null) {
    document.getElementById("user-def-container").remove();
  }

  let depth = json.depth;

  // If we defined a word higher up the page, remove everything below it
  if (click_depth == 0) {
    document.querySelector(".dictionary-display").innerHTML = "";
  } else {
    document.querySelectorAll(".dictionary-display > *").forEach((e) => {
      if (e.dataset.divdepth > click_depth) {
        e.remove();
      }
    });
  }

  document.querySelector(".dictionary-display").innerHTML += `${json.def}`;

  // Hide buttons of definitions higher than the lowest one
  let btn_container = document.querySelector(
    `.def-button-container[data-btndepth='${click_depth}']`,
  );
  if (req_type != "switch" && click_depth != 0 && btn_container != null) {
    btn_container.style.display = "none";
  }

  // If definition exists
  if (
    document.getElementById(`jj-empty${depth}`) == null &&
    deck == "in-deck"
  ) {
    document.querySelector(
      `#jj${depth} > .def-button-container > .add-card`,
    ).style.display = "none";
    document
      .querySelector(`#jj${depth} > .def-button-container > .switch-dict`)
      .classList.add("req-word-in-deck");
  }

  // If definition missing
  if (
    document.getElementById(`jj-empty${depth}`) != null &&
    deck == "in-deck"
  ) {
    document
      .querySelector(`#jj-empty${depth} > .switch-dict`)
      .classList.add("req-word-in-deck");
  }

  if (document.getElementById(`jj${depth}`) == null) {
    highlight(word, id, "lookup_on");
    return;
  }

  // Downstream highlighting
  let searched = json.searched;
  let highlight_def = document
    .getElementById(`jj${depth}`)
    .querySelectorAll(".unknown-word");
  highlight_def.forEach((e) => {
    searched.forEach((word) => {
      if (word[0] == e.innerText) {
        e.classList.add("related-word-lookup");
      }
    });
  });

  // Check if word already added to cards during this session (using global python array!)
  // is in this new part, and, if so, if this depth is greater than the depth the card was
  // added. If it is greater, update the card's depth
  let cards_added = json.cards_added; // cards_added.append([word, depth])
  let check_cards = document
    .getElementById(`jj${depth}`)
    .querySelectorAll(".in-deck-word");
  check_cards.forEach((e) => {
    cards_added.forEach((word) => {
      if (word[0] == e.innerText && word[1] < depth) {
        update_card(word[0], depth);
      }
    });
  });
  // highlight('', '', 'depth_click_fix', '');
  highlight(word, id, "lookup_on");
  window.scrollTo(0, document.body.scrollHeight);
}

// Search EJ dictionary
async function search_ej(word, id, req_type, deck, click_depth) {
  let dive = 0;
  if (req_type != "switch") {
    dive = 1;
    // if (deck != "in-deck") {
    //     highlight(word, id, 0, 'on')
    // };
  }
  // highlight(word, id, "lookup_on");

  const response = await fetch("/get_ej", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      def: word,
      dive: dive,
      click_depth: click_depth,
    }),
  });
  const json = await response.json();

  if (document.getElementById("user-def-container") != null) {
    document.getElementById("user-def-container").remove();
  }

  let depth = json.depth;

  // Before we can attach the new definition, we have to delete everything underneath it
  // if there are things after it.
  if (click_depth == 0) {
    document.querySelector(".dictionary-display").innerHTML = "";
  } else {
    document.querySelectorAll(".dictionary-display > *").forEach((e) => {
      if (e.dataset.divdepth > click_depth) {
        e.remove();
      }
    });
  }

  document.querySelector(".dictionary-display").innerHTML += `${json.def}`;

  let btn_container = document.querySelector(
    `.def-button-container[data-btndepth='${click_depth}']`,
  );
  if (req_type != "switch" && click_depth != 0 && btn_container != null) {
    btn_container.style.display = "none";
  }

  // If definition exists
  if (
    document.getElementById(`ej-empty${depth}`) == null &&
    deck == "in-deck"
  ) {
    document.querySelector(
      `#ej${depth} > .def-button-container > .add-card`,
    ).style.display = "none";
    document
      .querySelector(`#ej${depth} > .def-button-container > .switch-dict`)
      .classList.add("req-word-in-deck");
  }

  // If definition missing
  if (
    document.getElementById(`ej-empty${depth}`) != null &&
    deck == "in-deck"
  ) {
    document
      .querySelector(`#ej-empty${depth} > .switch-dict`)
      .classList.add("req-word-in-deck");
  }

  // highlight('', '', 'depth_click_fix', '');
  highlight(word, id, "lookup_on");
  window.scrollTo(0, document.body.scrollHeight);
}

// Update card status
async function update_card(word, depth) {
  const response = await fetch("/update_card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      word: word,
      depth: depth,
    }),
  });
  const json = await response.json();
}

// HIGHLIGHT
function highlight(word, id, type) {
  // .selected-word-hover, .selected-word-click, .selected-word-lookup
  // .related-word-hover, .related-word-click, .related-word-lookup
  let hlt_word = document.querySelectorAll(`span:has(+ [data-word='${word}'])`);

  if (type == "hover_on") {
    if (
      document
        .getElementById(`${id}`)
        .matches(".selected-word-click", ".selected-word-lookup")
    ) {
      return;
    }
    hlt_word.forEach((e) => {
      if (e.id == id) {
        e.classList.add("selected-word-hover");
      } else {
        e.classList.add("related-word-hover");
      }
    });
    return;
  }
  if (type == "hover_off") {
    hlt_word.forEach((e) => {
      if (e.id == id) {
        e.classList.remove("selected-word-hover");
      } else {
        e.classList.remove("related-word-hover");
      }
    });
    return;
  }
  if (type == "click_on") {
    if (document.getElementById(`${id}`).matches(".selected-word-lookup")) {
      return;
    }
    hlt_word.forEach((e) => {
      // e.classList.remove("selected-word-hover", "related-word-hover")
      if (e.id == id) {
        e.classList.add("selected-word-click");
      } else {
        e.classList.add("related-word-click");
      }
    });
    return;
  }
  if (type == "click_off") {
    hlt_word.forEach((e) => {
      if (e.id == id) {
        e.classList.remove("selected-word-click");
      } else {
        e.classList.remove("related-word-click");
      }
    });
    return;
  }
  if (type == "lookup_on") {
    // if id == null, we are switching the dict -- do nothing, return
    if (id == null) {
      return;
    }

    // For every word, remove preceding classes (e.g. selected-word-hover)
    // Ensure lookup source word gets .selected-word-lookup
    // Ensure all related words get .related-word-lookup

    hlt_word.forEach((e) => {
      e.classList.remove("selected-word-click", "related-word-click");
      if (e.id == id) {
        e.classList.add("selected-word-lookup");
      } else {
        e.classList.add("related-word-lookup");
      }
    });
  }

  // Get list of all defined words on screen (".kanji-displayed")
  // Go through every highlighted word on screen.
  // If word has .selected-word-lookup||.related-word-lookup
  //  and is *not* in the list, remove those classes
  let defs_onscreen = [];
  document.querySelectorAll(".kanji-displayed").forEach((e) => {
    defs_onscreen.push(e.innerHTML);
  });

  document.querySelectorAll(".selected-word-lookup").forEach((e) => {
    let cur_word = e.nextElementSibling.dataset.word;
    if (!defs_onscreen.includes(cur_word)) {
      document
        .querySelectorAll(
          `.related-word-lookup:has(+ [data-word='${cur_word}'])`,
        )
        .forEach((e) => {
          e.classList.remove("related-word-lookup");
        });
      e.classList.remove("selected-word-lookup");
    }
  });
}

// "Go back" button functionality
async function go_back(id, word) {
  // highlight(word, 0, 'go_back', 'off')
  if (document.getElementById("user-def-container") != null) {
    document.getElementById("user-def-container").remove();
  }
  if (document.getElementById("user-token-container") != null) {
    document.getElementById("user-token-container").remove();
  }
  document.getElementById(`${id}`).remove();

  const response = await fetch("/go_back", {
    method: "POST",
  });
  const json = await response.json();

  let btn_container = document.querySelector(
    `.def-button-container[data-btndepth='${json.depth}']`,
  );
  if (btn_container != null) {
    btn_container.style.display = "block";
  }
  // highlight('', '', 'depth_click_fix', '');
  highlight(word, "", "lookup_off");
}

// Switch dictionary
function switch_dict(word, id, type, word_id) {
  let deck;
  let depth = document.getElementById(`${id}`).dataset.divdepth;

  if (
    document
      .querySelector(`#${id} > .def-button-container > .switch-dict`)
      .classList.contains("req-word-in-deck")
  ) {
    deck = "in-deck";
  }

  document.getElementById(`${id}`).remove();

  // Call search on other dict
  if (type == "jj" || type == "jj-empty") {
    search_ej(word, null, "switch", deck, depth);
  } else {
    search_jj(word, null, "switch", deck, depth);
  }
}

// Add word to flashcards
async function add_card(word, depth, lang) {
  // Add to DB
  const response = await fetch("/add_card", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      word: word,
      depth: depth,
      lang: lang,
    }),
  });
  const json = await response.json(); // {"word": word}

  // Re-mark all words on screen
  document
    .querySelectorAll(`.unknown-word:has(+ [data-word='${word}'])`)
    .forEach((e) => {
      // let current_depth = e.parentElement.parentElement.id.substring(2,);
      e.parentElement.classList.remove(...e.parentElement.classList);
      e.parentElement.classList.add("in-deck");
      e.classList.remove(...e.classList);
      e.classList.add("in-deck-word");
      e.onclick = () => {
        dropdown(`${e.nextElementSibling.id}`, "in-deck");
      };
      e.onmouseover = "";
      e.onmouseout = "";
      e.nextElementSibling.innerHTML = `
                <span class="close" onclick="closeup('${e.nextElementSibling.id}', '${word}')">&times;</span>
                <button onclick="swap_word('${word}', 'in-deck-to-known'); closeup('${e.nextElementSibling.id}', '${word}')">Mark Known</button>
                <button onclick="swap_word('${word}', 'in-deck-to-unknown'); closeup('${e.nextElementSibling.id}', '${word}')">Mark Unknown</button>
                <button onclick="search_jj('${word}', '${e.nextElementSibling.id}', 'null', 'in-deck', '${e.parentElement.parentElement.dataset.divdepth}'); closeup('${e.nextElementSibling.id}', '${word}')">Japanese Lookup</button>
                <button onclick="search_ej('${word}', '${e.nextElementSibling.id}', 'null', 'in-deck', '${e.parentElement.parentElement.dataset.divdepth}'); closeup('${e.nextElementSibling.id}', '${word}')">English Lookup</button>
            `;
    });

  // If lang == EN we should 'go-back'
  go_back(`${lang}${depth}`, word);
}

// Builds the input fields for user definition entry
function add_user_def(word, id, type, is_def_empty) {
  // If #user-token-container exists, delete
  if (document.getElementById("user-token-container") != null) {
    document.getElementById("user-token-container").remove();
  }

  document.querySelector(".dictionary-display").innerHTML += `
        <br>
        <div id="user-def-container">
            <form id="user-def-form">
                <input type="hidden" name="word" value="${word}" />
                <label for="definition">Definition</label>
                <br>
                <input name="definition" type="text" />
                <br><br>
                <label for="reading">Reading</label>
                <br>
                <input name="reading" type="text" />
                <br><br>
                <p>Which language is the definition in?</p>
                <input type="radio" class="user_def_jj" name="user_def_lang" value="jj" checked />
                <label for="user_def_jj">Japanese</label>
                <input type="radio" class="user_def_ej" name="user_def_lang" value="ej"/>
                <label for="user_def_ej">English</label>
                <br>
                <button onclick="store_user_def(event, '${id}', '${type}', '${is_def_empty}')">Submit</button>
            </form>
        </div>
    `;
  window.scrollTo(0, document.body.scrollHeight);
}

async function store_user_def(event, id, type, is_def_empty) {
  // Prevent page from reloading when clicking "add user def"
  event.preventDefault();

  // Structure form data to send to Flask/SQL
  const form_data = new FormData(document.getElementById("user-def-form"));
  const json_data = {};
  for (const [key, value] of form_data) {
    json_data[key] = value;
  }

  const response = await fetch("/add_user_def", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(json_data),
  });
  const json = await response.json();

  document.getElementById("user-def-container").remove();

  // Changes displayed definition
  if (json.lang == "jj" && (type == "jj" || type == "jj-empty")) {
    // Not actually switching the dict, just using the functionality
    switch_dict(json.word, id, "ej");
  } else if (json.lang == "ej" && (type == "ej" || type == "ej-empty")) {
    // Not actually switching the dict, just using the functionality
    switch_dict(json.word, id, "jj");
  } else if (json.lang == "jj" && (type == "ej" || type == "ej-empty")) {
    switch_dict(json.word, id, type);
  } else if (json.lang == "ej" && (type == "jj" || type == "jj-empty")) {
    switch_dict(json.word, id, type);
  } else {
    go_back(id, json.word);
  }
}

function add_user_token() {
  // If #user-def-container exists, delete
  if (document.getElementById("user-def-container") != null) {
    document.getElementById("user-def-container").remove();
  }
  document.querySelector(".dictionary-display").innerHTML += `
        <br>
        <div id="user-token-container">
            <form id="token-input-form">
                <label for="word">Word</label>
                <input type="text" name="word" />
                <br>
                <label for="reading">Reading</label>
                <input type="text" name="reading" />
                <button onclick="submit_user_token(event)">Submit</button>
            </form>
        </div>
    `;

  window.scrollTo(0, document.body.scrollHeight);
}

async function submit_user_token(event) {
  event.preventDefault();

  const form_data = new FormData(document.getElementById("token-input-form"));
  const json_data = {};
  for (const [key, value] of form_data) {
    json_data[key] = value;
  }

  const response = await fetch("/tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(json_data),
  });
  const json = await response.json();

  document.getElementById("token-input-form").remove();
}

async function reset_progress(reset_type, id) {
  const response = await fetch("/reset_progress", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reset_type: reset_type }),
  });
  const json = await response.json();

  document.getElementById(`${id}`).togglePopover();
}
