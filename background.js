// background.js
const anki_connect = 'http://127.0.0.1:8765';

chrome.runtime.onInstalled.addListener(() => {
  
  chrome.storage.local.set({tako_idList: []});
  chrome.storage.local.set({tako_wordList: []});
  chrome.storage.local.set({downloadState: 0});

  chrome.storage.local.set({deck_name: ''});
  chrome.storage.local.set({deck_model: ''});

  chrome.storage.local.set({anki_deck_names: []});
  chrome.storage.local.set({anki_deck_models: []});

  chrome.storage.local.set({last_error: ''});

});


chrome.runtime.onMessage.addListener((m) => {
  if(m.type == 'scrap'){
    callForScrapping();
  }

  if(m.type == 'send'){
    callForSending();
  }

  if(m.type == 'options'){
    callForOptions();
  }

  if(m.type == 'save_changes'){
    callForSaveChanges(m.data.model, m.data.deck);
  }

  return true;
});

// -- Anki
function getParamCard(japanese, english, hiragana, image = null){
  return {
    "notes": [{
        "deckName": deck_name,
        "modelName": 'Ankiboto_' + deck_model,
        "fields": {
            "Japanese": japanese,
            "English": english,
            "Hiragana" : hiragana
        },
        "options": {
            "closeAfterAdding": false
        },
        "picture": [{
            "url": "https://api.lorem.space/image?w=300&h=300",
            "filename": "random.png",
            "fields": [
                "Image"
            ]
        }]
    }]
  }
}

function getParamCardContext(japanese, english, hiragana, c_japanese, c_english, c_hiragana, image = null){
  return {
    "notes": [{
        "deckName": deck_name,
        "modelName": 'Ankiboto_' + deck_model,
        "fields": {
            "Japanese": japanese,
            "English": english,
            "Hiragana" : hiragana,
            "Context_Japanese" : c_japanese,
            "Context_Hiragana" : c_hiragana,
            "Context_English" : c_english,
        },
        "options": {
            "closeAfterAdding": false
        },
        "picture": [{
            "url": "https://api.lorem.space/image?w=300&h=300",
            "filename": "random.png",
            "fields": [
                "Image"
            ]
        }]
    }]
  }
}

function callForSaveChanges(model, deck){
  if(model != 'null'){
    chrome.storage.local.get(['anki_deck_models'], (response) => {
      let model_exists = response['anki_deck_models'].includes('Ankiboto_'+model);
      if(!model_exists){createModel(model);}
      chrome.storage.local.set({deck_model: model});
      deck_model = model;
    });
  }

  if(deck != 'null'){
    chrome.storage.local.set({deck_name: deck});
    deck_name = deck;
  }
  
}

function createModel(model){
  let model_template;

  switch(model){
    case 'Classic': //just skip exemple in the scrapping
    case 'Default':
      model_template = [ //TODO : HR  (trait) / BR (espace)
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
      break;
    case 'Context':
      model_template = [{
        "Name": "Production",
        "Front": '{{English}} <br>--- context sentence ---<br> {{Context_English}}',
        "Back": '{{FrontSide}}<hr id=answer><span style="font-size: 30px">{{Japanese}}</span><br>{{Hiragana}}<br>{{Context_Japanese}}<br>{{Context_Hiragana}}<br>{{Image}}'
      },
      {
        "Name": "Recognition",
        "Front": '<span style="font-size: 30px">{{Japanese}}</span><br>{{Context_Japanese}}',
        "Back": '{{FrontSide}}<hr id=answer>{{English}}<hr id=answer>{{Hiragana}}<br>{{Context_English}}<br>{{Context_Hiragana}}<br>{{Image}}'
      }]
      break;
  } 

  let params = {
    "modelName": "Ankiboto_" + model,
    "inOrderFields": ["Japanese", "English", "Hiragana", "Image", "Context_Japanese", "Context_English", "Context_Hiragana"],
    "css": ".card {font-family: Yu Mincho Demibold;font-size: 23px;text-align: center;color: black;background-color: white;}.card1 { background-color: #ffffff; }.card2 { background-color: #ffffff; }",
    "isCloze": false,
    "cardTemplates": model_template
  }

  invoke('createModel', 6, params);
}


let deck_name = null;
let deck_model = null;

function callForSending(){
  if(deck_name != null){
    sendCards();
  }else{
    let flag = false;
    chrome.storage.local.get(['deck_name'], function(result) {
      const value = result.deck_name;
      flag = (value != '');

      chrome.storage.local.get(['deck_model'], function(result) {
        const value = result.deck_model;
        flag = (value != '') && flag;

        if(flag){sendCards();}
      });
    });
  }
}

function callForOptions(){
  const deck_names = invoke('deckNames', 6);
  const deck_models = invoke('modelNames', 6);

  deck_names.then((data) => {
    
    if(data.error == null){
      chrome.storage.local.set({anki_deck_names: data.result});
    }else{
      console.log(data.error);
      chrome.storage.local.set({last_error: data.error});
    }
    
  });

  deck_models.then((data) => {
    if(data.error == null){
      chrome.storage.local.set({anki_deck_models: data.result});
    }else{
      console.log(data.error);
      chrome.storage.local.set({last_error: data.error});
    }
    
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
            cards_ready.push(data['card_word']);
            if(deck_model != 'Context') {cards_ready.push(data['card_exemple'])};
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

    if(deck_model != 'Classic'){
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
  }

  let final_card = {};

  if(deck_model == 'Context'){
    final_card = {
      'card_word' : {
        'jap' : card_word_japanese,
        'eng' : card_word_english,
        'hir' : card_word_hiragana,
        'cjap' : card_ex_japanese,
        'ceng' : card_ex_english,
        'chir' : card_ex_hiragana,
      }
    }
  }else{
    final_card = {
      'card_word' : {
        'jap' : card_word_japanese,
        'eng' : card_word_english,
        'hir' : card_word_hiragana,
      },
      'card_exemple' : {
        'jap' : card_ex_japanese,
        'eng' : card_ex_english,
        'hir' : card_ex_hiragana,
      }
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

  try{
    let response = await fetch(anki_connect, {
      headers : headers,
      method: 'POST',
      body: opts,
    })
  
    let json = await response.json();
    return json;

  }catch(e){
    const error = {
      'error' : 'Please make sure Anki is running.',
      'msg' : e.TypeError,
    }

    return error;
  }
}

async function sendCards() {

  for(const [idx, data] of cards_ready.entries()){
    if(data['jap'] == ''){continue;}
    let param = null;

    if(deck_model == 'Context'){
      param = getParamCardContext(data['jap'], data['eng'], data['hir'],data['cjap'], data['ceng'], data['chir']);
    }else{
      param = getParamCard(data['jap'], data['eng'], data['hir']);
    }

    const card = await invoke('addNotes', 6, param);
  }

  console.log('All cards are done');

  //Cleaning everything
  chrome.storage.local.set({tako_idList: []});
  chrome.storage.local.set({tako_wordList: []});
  chrome.storage.local.set({downloadState: 0});

}

