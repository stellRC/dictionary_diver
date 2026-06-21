import requests
import re
import os

from cs50 import SQL
from flask import redirect, render_template, session
from functools import wraps
from datetime import datetime
from janome.tokenizer import Tokenizer
# t = Tokenizer("user_dict.csv", udic_enc="utf8", wakati=True)
# t = Tokenizer("user_dict.csv", udic_type="simpledic", udic_enc="utf8", wakati=True)

# Configure CS50 Library to use SQLite database
db = SQL("sqlite:///dict.db")


def apology(message, code=400):
    """Render message as an apology to user."""

    def escape(s):
        """
        Escape special characters.

        https://github.com/jacebrowning/memegen#special-characters
        """
        for old, new in [
            ("-", "--"),
            (" ", "-"),
            ("_", "__"),
            ("?", "~q"),
            ("%", "~p"),
            ("#", "~h"),
            ("/", "~s"),
            ('"', "''"),
        ]:
            s = s.replace(old, new)
        return s

    return render_template("apology.html", top=code, bottom=escape(message)), code


def login_required(f):
    """
    Decorate routes to require login.

    https://flask.palletsprojects.com/en/latest/patterns/viewdecorators/
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get("user_id") is None:
            return redirect("/login")
        return f(*args, **kwargs)

    return decorated_function


def text_parser(text, user_id):
    # If user token file exists, use it, Else use default
    if os.path.exists(f'user_tokens/tokens{user_id}.csv'):
        t = Tokenizer(f'user_tokens/tokens{user_id}.csv', udic_type="simpledic", udic_enc="utf8", wakati=True)
    else:
        t = Tokenizer('default_tokens.csv', udic_type="simpledic", udic_enc="utf8", wakati=True)

    tokens = []
    tokens.extend(t.tokenize(text))
    return tokens


def def_cleaner(def_raw):
    # If multiple parts of speech
    if "🈩" in def_raw:
        first_pos = def_raw.find('🈩')
        def_main = def_raw[first_pos:]
        def_clean = rm_braces('<br>'.join(re.findall(r'(?:[①-⑳]|🈩|🈔|🈪|[㋐-㋾])[^\\n]*', def_main)))
        return def_clean

    # If multi-definition
    elif "①" in def_raw:
        first_def = def_raw.find('①')
        def_main = def_raw[first_def:]
        def_clean = rm_braces('<br>'.join(re.findall(r'(?:[①-⑳]|🈩|🈔|🈪|[㋐-㋾])[^\\n]*', def_main)))
        return def_clean

    # If single definition
    else:
        first_n = def_raw.find('\\n')
        def_main = def_raw[first_n+2:]
        def_clean = rm_braces(def_main)
        return def_clean


def rm_braces(text):
    # Remove all extraneous info & anything after additional \n
    # Chars used for extraneous info: 「」【】〘〙
    def_rm_lbrace = re.sub('「.+?」', '', text)
    def_rm_cbrace = re.sub('【.+?】', '', def_rm_lbrace)
    def_rm_wbrace = re.sub('〘.+?〙', '', def_rm_cbrace)
    def_rm_nline = def_rm_wbrace[:def_rm_wbrace.find('\\n')]
    return def_rm_nline


def def_builder(req, kana, text, type, depth, user):
    if type == "jj-empty" or type == "ej-empty":
        message = f"""
                <div id="{type}{depth}" class="dict-card" data-divdepth="{depth}">
                    <h2 class="kanji-displayed dic-header">{req}</h2>
                    <br><br>
                    <span class="define{type}" data-depth="{depth}">{text}</span>
                    <div class="def-button-container" data-btndepth="{depth}">
                        <button class="switch-dict button-color" onclick="switch_dict('{req}', '{type}{depth}', '{type}')">Switch dictionary</button>
                        <br>
                        <button class="button-color onclick="add_user_def('{req}', '{type}{depth}', '{type}', 'empty')">Add user definition</button>
                        <br>
                        <button class="button-color" onclick="add_user_token()">Add user token</button>
                        <br>
                        <button class="button-color" onclick="go_back('{type}{depth}', '{req}')">Go back</button</button>
                    </div>
                </div>
                """
        return message

    analyzed_text = []
    if type == "ej":
        analyzed_text.append(
            f"""<div id="{type}{depth}" class="dict-card" data-divdepth="{depth}"><h2 class="kanji-displayed">{req}</h2>""")
        for definition in text:
            if definition['sound'] is None:
                definition['sound'] = ''
            analyzed_text.append(
                f"""
                        <h3 class="kana-displayed">{definition['sound'].replace(']', '').replace('[', '').replace('"', '')}</h3>
                        <span class="define{type}" data-depth="{depth}">
                        {definition['definition'].
                         replace(']', '').replace('[', '').
                         replace(';  ","', ';<br>').replace(',', ', ').
                         replace('"', '')}
                        </span>
                        <br><br>
                    """)

        analyzed_text.append(
            f"""
                    <div class="def-button-container" data-btndepth="{depth}">
                        <button class="add-card button-color" onclick="add_card('{req}', '{depth}', 'ej')">Add to flash cards</button</button>
                        <br>
                        <button class="switch-dict button-color" onclick="switch_dict('{req}', '{type}{depth}', '{type}')">Switch dictionary</button>
                        <br>
                        <button class="button-color" onclick="add_user_def('{req}', '{type}{depth}', '{type}', '')">Add user definition</button>
                        <br>
                        <button class="button-color" onclick="add_user_token()">Add user token</button>
                        <br>
                        <button class="button-color" onclick="go_back('{type}{depth}', '{req}')">Go back</button</button>
                    </div>
                </div>
                """
        )
        return analyzed_text

    # if type == "jj":
    if type == "jj":
        analyzed_text.append(
            f'<div id="{type}{depth}" class="dict-card" data-divdepth="{depth}"><br> <h2 class="kanji-displayed">{req}</h2><h3 class="kana-displayed">{kana}</h3>')

    i = 0
    for word in text:
        if word == "<br>":
            analyzed_text.append("<br>")
            continue

        # Position menu
        if len(word) == 1:
            left = 'style="left:-450%;"'
        elif len(word) == 2:
            left = 'style="left:-200%;"'
        elif len(word) == 3:
            left = 'style="left:-115%;"'
        elif len(word) == 4:
            left = 'style="left:-75%;"'
        else:
            left = 'style="left:-50%;"'
        check = db.execute(
            f"SELECT word, status FROM user_words WHERE user_id=? AND word=?", user, word)

        furigana = db.execute("SELECT sound FROM jj WHERE word=?", word)
        if len(furigana) > 0:
            furigana = furigana[0]['sound']
        else:
            furigana = ''

        # If word unknown
        if len(check) == 0:
            analyzed_text.append(
                f"""
                <span class="unknown" >
                    <span id="txt{depth}{i}" class="unknown-word"
                        onclick="dropdown('{word}', 'txtmenu{depth}{i}', 'txt{depth}{i}')"
                        onmouseover="highlight('{word}','txt{depth}{i}', 'hover_on')"
                        onmouseout="highlight('{word}', 'txt{depth}{i}', 'hover_off')">
                        {word}
                    </span>
                    <span class="dropdown-text" {left} id="txtmenu{depth}{i}" data-word="{word}">
                        <span class="close" onclick="closeup('txtmenu{depth}{i}', '{word}')">&times;</span>
                        <span class="menu-kana">{furigana}</span>
                        <button class="button-color" onclick="swap_word('{word}', 'unknown'); closeup('txtmenu{depth}{i}', '{word}')">Mark Known</button>
                        <button class="button-color" onclick="search_jj('{word}', 'txt{depth}{i}', 'null', 'null', '{depth}'); closeup('txtmenu{depth}{i}', '{word}')">Japanese Lookup</button>
                        <button class="button-color" onclick="search_ej('{word}', 'txt{depth}{i}', 'null', 'null', '{depth}'); closeup('txtmenu{depth}{i}', '{word}')">English Lookup</button>
                    </span>
                </span>
                """)
        # If word in deck
        elif check[0]["status"] != 0:
            analyzed_text.append(
                f"""
                <span class="in-deck">
                    <span id="txt{depth}{i}" class="in-deck-word"
                        onclick="dropdown('{word}', 'txtmenu{depth}{i}', 'txt{depth}{i}')"
                        onmouseover="highlight('{word}','txt{depth}{i}', 'hover_on')"
                        onmouseout="highlight('{word}', 'txt{depth}{i}', 'hover_off')">
                    {word}
                    </span>
                    <span class="dropdown-text" {left} id="txtmenu{depth}{i}" data-word="{word}">
                        <span class="close" onclick="closeup('txtmenu{depth}{i}', '{word}');">&times;</span>
                        <span class="menu-kana">{furigana}</span>
                        <button class="button-color" onclick="swap_word('{word}', 'in-deck-to-known'); closeup('txtmenu{depth}{i}', '{word}')">Mark known</button>
                        <button class="button-color" onclick="swap_word('{word}', 'in-deck-to-unknown'); closeup('txtmenu{depth}{i}', '{word}')">Mark Unknown</button>
                        <button class="button-color" onclick="search_jj('{word}', 'txt{depth}{i}', 'null', 'in-deck', '{depth}'); closeup('txtmenu{depth}{i}', '{word}')">Japanese Lookup</button>
                        <button class="button-color" onclick="search_ej('{word}', 'txt{depth}{i}', 'null', 'in-deck', '{depth}'); closeup('txtmenu{depth}{i}', '{word}')">English Lookup</button>
                    </span>
                </span>
                """)

        # If word known
        else:
            analyzed_text.append(
                f"""
                <span class="known" >
                    <span id="txt{depth}{i}" class="known-word"
                        onclick="dropdown('{word}', 'txtmenu{depth}{i}', 'txt{depth}{i}')"
                        onmouseover="highlight('{word}','txt{depth}{i}', 'hover_on')"
                        onmouseout="highlight('{word}', 'txt{depth}{i}', 'hover_off')">
                    {word}
                    </span>
                    <span class="dropdown-text" {left} id="txtmenu{depth}{i}" data-word="{word}">
                        <span class="close" onclick="closeup('txtmenu{depth}{i}', '{word}');">&times;</span>
                        <span class="menu-kana">{furigana}</span>
                        <button class="button-color" onclick="swap_word('{word}', 'known'); closeup('txtmenu{depth}{i}', '{word}')">Mark Unknown</button>
                        <button class="button-color" onclick="search_jj('{word}', 'txt{depth}{i}', 'null', 'in-deck', '{depth}'); closeup('txtmenu{depth}{i}', '{word}')">Japanese Lookup</button>
                        <button class="button-color" onclick="search_ej('{word}', 'txt{depth}{i}', 'null', 'in-deck', '{depth}'); closeup('txtmenu{depth}{i}', '{word}')">English Lookup</button>
                    </span>
                </span>
                """)
        i = i + 1

    if type == "jj":
        analyzed_text.append(
            f"""
                        <div class="def-button-container" data-btndepth="{depth}">
                            <button class="add-card button-color" onclick="add_card('{req}', '{depth}', 'jj')">Add to flash cards</button</button>
                            <br>
                            <button class="switch-dict button-color" onclick="switch_dict('{req}', '{type}{depth}', '{type}')">Switch dictionary</button>
                            <br>
                            <button class="button-color" onclick="add_user_def('{req}', '{type}{depth}', '{type}', '')">Add user definition</button>
                            <br>
                            <button class="button-color" onclick="add_user_token()">Add user token</button>
                            <br>
                            <button class="button-color" onclick="go_back('{type}{depth}', '{req}')">Go back</button</button>
                        </div>
                    </div>
            """
        )
    return analyzed_text


def eng_card_def_builder(text):
    analyzed_text = []
    analyzed_text.append(f"""<div id="definition"><br>""")
    for definition in text:
        if definition['sound'] is None:
            definition['sound'] = ''
        analyzed_text.append(
            f"""
                    <h3 class="kana-displayed">{definition['sound'].replace(']', '').replace('[', '').replace('"', '')}</h3>
                    <span class="card-def">
                    {definition['definition'].
                     replace(']', '').replace('[', '').
                     replace(';  ","', ';<br>').replace(',', ', ').
                     replace('"', '')}
                    </span>
                    <br><br>
                """)

    analyzed_text.append(f"""</div>""")
    return analyzed_text


def build_study_deck(user):
    now = datetime.now().isoformat()
    deck = (db.execute("SELECT word, status, lang, level, due FROM user_words WHERE user_id=? AND status > 0 AND datetime(due) < datetime(?)", user, now))

    for card in deck:
        card['due'] = datetime.fromisoformat(card['due'])

    return sorted(deck, key=lambda card: card['status'], reverse=True)
