// background.js
let anki_connect = 'http://127.0.0.1:8765';

let idList = [];
let wordList = [];

chrome.runtime.onInstalled.addListener(() => {
  //chrome.storage.sync.set({ anki_connect });
  
  chrome.storage.local.set({tako_idList: idList});
  chrome.storage.local.set({tako_wordList: wordList});
  chrome.storage.local.set({downloadState: 0});

  //console.log('Anki-Connect should be listening at ' + anki_connect);
});

chrome.runtime.onMessage.addListener((m) => {


  if(m.type == 'clear'){
    idList = [];
    wordList = [];
    console.log('clearing back');
  }

  if(m.type == 'scrap'){
    callForScrapping();
  }

  if(m.type == 'send'){
    callForSending();
  }
  
});

// -- Anki
function getParamCard(japanese, english, hiragana, image = null){
  return {
    "note": {
        "deckName": deck_name,
        "modelName": "Ankiboto",
        "fields": {
            "Japanese": japanese,
            "English": english,
            "Hiragana" : hiragana
        },
        "options": {
            "closeAfterAdding": true
        },
        "picture": [{
            "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/EU-Romania.svg/285px-EU-Romania.svg.png",
            "filename": "romania.png",
            "fields": [
                "Image"
            ]
        }]
    }
  }
}
let deck_name = null;
let model_exists = false;

//https://morioh.com/p/5b3ee5fb9ec6
//Attendre le result avant de refaire un fetch

function callForSending(){

  let model_check = invoke('modelNames', 6);
  model_check.then((data) => {
    console.log(data);
    data.result.forEach(element => {
      if(element == 'Ankiboto'){
        model_exists = true;
        console.info('Model aleady exist ! :)');
      }
    });
  }).then(() => {
    if(!model_exists){
      console.info('We should create a new model.');
      let params = {
        "modelName": "Ankiboto",
        "inOrderFields": ["Japanese", "English", "Hiragana", "Image"],
        "css": ".card {font-family: Yu Mincho Demibold;font-size: 23px;text-align: center;color: black;background-color: white;}.card1 { background-color: #ffffff; }.card2 { background-color: #ffffff; }",
        "isCloze": false,
        "cardTemplates": 
        [
          {
            "Name": "Production",
            "Front": "{{English}}",
            "Back": '{{FrontSide}}<hr id=answer><span style="font-size: 30px">{{Japanese}}</span><br>{{Hiragana}}<br>{{Image}}'
          },
          {
            "Name": "Recognition",
            "Front": '<span style="font-size: 30px">{{Japanese}}</span>',
            "Back": '{{FrontSide}}<hr id=answer>{{English}}<hr id=answer>{{Hiragana}}<br>{{Image}}'
          }
        ]
      }

      let create_model = invoke('createModel', 6, params);
      create_model.then((data) => {
        console.log(data);
        console.info('model created');
      });
    }
  });

  

  let deck_list = invoke('deckNames', 6);
  deck_list.then((data) => {
    console.log(data);
    data.result.forEach(element => {
      if(element.startsWith('[AB]')){
        deck_name = element;
      }
    });

    if(deck_name == null){
      console.warn('Did you mark a deck with [AB] ?');
      return;
    }

    console.log(deck_name);

    cards_ready.forEach(element => {
      console.log(element);

      let params_word = getParamCard(element.card_exemple.exemple_jap,element.card_exemple.exemple_eng,element.card_exemple.exemple_hir);
      invoke('guiAddCards', 6, params_word).then((data) => console.log(data));

      if(element.card_exemple.exemple_jap != ''){
        let params_ex   = getParamCard(element.card_word.word_jap, element.card_word.word_eng,element.card_word.word_hir);
        invoke('guiAddCards', 6, params_ex).then((data) => console.log(data));
      }
    });

  }).catch((e) => {
    console.warn('Are you sure Anki is running ?');
    console.log(e);
  });
}

// --- Scrapping

let loading_len = 0;
let loading_done = 0;
let loading_failed = 0;

let cards_ready = [];

function callForScrapping(){
  chrome.storage.local.get(['tako_idList'], function(response) {
    if(response['tako_idList'] == undefined){
      console.log('Word list is empty.')
    }else{
      loading_len = response['tako_idList'].length;
      response['tako_idList'].forEach(
        element => {
          let result = invokeScrap(element);
          result.then((data) => {
            console.log(updateLoading(true));
            cards_ready.push(data);
          });
        }
      );
    }
  })
}

function updateLoading(isDownloaded){
  if(isDownloaded){loading_done += 1;}
  else{loading_failed += 1;}

  if(loading_done == loading_len){
    chrome.storage.local.set({downloadState: 100});
    console.log(cards_ready);
    return 100;
  }
  let p = (loading_done + loading_failed) / loading_len*100
  chrome.storage.local.set({downloadState: p});
  return p;
}

function getStringUntil(string, char, skip = 0){
  let word = '';
  for (let index = 0; index < string.length; index++) {
    if(index > 0){index += skip;}
    
    const element = string[index];
    if(element == char){break;}
    word += element;
  }
  return word;
}

function getHiraganaUntil(string, char, stop = 12436){
  let word ='';
  for (let index = 0; index < string.length; index++) {
    const element = string[index];
    const element_after = string[index+1];

    if(element + element_after == char){break;}

    const exeptions = (element.charCodeAt(0) == 12301 || element.charCodeAt(0) == 12300 || element.charCodeAt(0) == 12290);
    if( (element.charCodeAt(0) >= 12353 && element.charCodeAt(0) <= stop) || exeptions) {
      word += element;
    }else{
      continue;
    }
  }
  return word;
}

async function invokeScrap(id){
  // -- const
  const start_point = '<span style="font-size:34px;font-weight:bold"> ';
  const hiragana_point = 'Readings';
  const english_point = '<span style="font-size:17px;vertical-align:middle">';
  const exemple_point = 'Phrases';

  const exemple_phrase_point = 'onWordJapOut';
  const exemple_parts_point = 'Parts';
  const exemple_english_point = '<span style="vertical-align:middle">';

  // -- vars 
  let left_over = '';

  let card_word_japanese = '';
  let card_word_english = '';
  let card_word_hiragana = '';

  let card_ex_japanese = '';
  let card_ex_english = '';
  let card_ex_hiragana = '';

  // -- fetch word
  let response_word = await fetch('https://takoboto.jp/?w='+id);
  let response_word_html = await response_word.text();

  // -- processing word
  response_word_html = response_word_html.substring(response_word_html.indexOf(start_point) + start_point.length);
  card_word_japanese = getStringUntil(response_word_html, '<');
  
  response_word_html = response_word_html.substring(response_word_html.indexOf(hiragana_point) + hiragana_point.length);
  card_word_hiragana = getHiraganaUntil(response_word_html, 'br');;

  response_word_html = response_word_html.substring(response_word_html.indexOf(english_point) + english_point.length)
  card_word_english = getStringUntil(response_word_html, '<');

  response_word_html = response_word_html.substring(response_word_html.indexOf(exemple_point, 5) + exemple_point.length);
 
  left_over = response_word_html;

  // -- fetch exemple
  let response_exemple = await fetch('https://takoboto.jp/?ajax=1&w='+id+'&type=phrases');
  let response_exemple_html = await response_exemple.text();

  response_exemple_html = left_over + response_exemple_html;

  // -- Processing exemple
  let number_of_exemple = (response_exemple_html.match(new RegExp(exemple_parts_point, "g")) || []).length;
  if(number_of_exemple > 0){
    let random_exemple_index = Math.floor(Math.random() * number_of_exemple);

    let total_sub = 0;
    for (let index = 0; index < random_exemple_index; index++) {
      total_sub = response_exemple_html.indexOf(exemple_phrase_point, total_sub + 1);
    }

    response_exemple_html = response_exemple_html.substring(total_sub + exemple_phrase_point.length);
    card_ex_japanese = getHiraganaUntil(response_exemple_html, '</', 99999);

    response_exemple_html = response_exemple_html.substring(response_exemple_html.indexOf(exemple_parts_point) + exemple_parts_point.length +2);
    card_ex_hiragana = response_exemple_html.split('</div>').shift();

    response_exemple_html = response_exemple_html.substring(response_exemple_html.indexOf(exemple_english_point) + exemple_english_point.length);
    card_ex_english = getStringUntil(response_exemple_html, '<');
  }
  
  let final_card = {
    'card_word' : {
      'word_jap' : card_word_japanese,
      'word_eng' : card_word_english,
      'word_hir' : card_word_hiragana,
    },
    'card_exemple' : {
      'exemple_jap' : card_ex_japanese,
      'exemple_eng' : card_ex_english,
      'exemple_hir' : card_ex_hiragana,
    }
  }

  return final_card;
}


// --- Anki Connect ---

async function invoke(action, version, params={}){
  let opts = JSON.stringify({action, version, params});
  let headers = new Headers();

  headers.append("Content-Type", "application/json");
  headers.append("Accept", "*/*");
  headers.append("Host", "localhost:8765");

  let response = await fetch('http://127.0.0.1:8765', {
    headers : headers,
    method: 'POST',
    body: opts,
  });

  let json = await response.json();
  return json;
}
