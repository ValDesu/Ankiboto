
window.onblur = function(){
  chrome.storage.local.set({anki_deck_names: []});
  chrome.storage.local.set({anki_deck_models: []});
}

chrome.storage.local.get(['downloadState'], function(result) {
  $('#loading').css('width', result.downloadState + '%');
  setBtnToSendAnki(result.downloadState);
});

let list_length = 0;
chrome.storage.local.get(['tako_wordList'], function(result) {
    $('#word-list').empty(); list_length = 0;
    result['tako_wordList'].forEach(element => {
      list_length++;
      $('<span class="btn btn-light" style="background-color: #ffffff38;border-color: #ffffff00;margin: 0 10px 5px 0;color: white;">'+ element +'</span>').appendTo('#word-list');
    });
});

chrome.storage.local.get(['anki_deck_names'], function(result) {
  result.anki_deck_names.forEach(e => {
    $('<option class="dropdown-item" value="" >'+ e +'</option>').appendTo('#deck_select');
  });
});

chrome.storage.onChanged.addListener(function (changes, namespace) {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    console.log(
      `Storage key "${key}" in namespace "${namespace}" changed.`,
      `Old value was "${oldValue}", new value is "${newValue}".`
    );

    if(key == 'downloadState'){
      $('#loading').css('width', newValue + '%');
      setBtnToSendAnki(newValue);
    }

    if(key == 'anki_deck_names'){
      $('#deck_select').empty();
      let deck_name = 'Choose a deck';

      chrome.storage.local.get(['deck_name'], (result) => {
        if(result.deck_name != ''){
          deck_name = result.deck_name
        }
        $('<option class="dropdown-item" value="null" >'+ deck_name +'</option>').appendTo('#deck_select');
        newValue.forEach(e => {
          $('<option class="dropdown-item" value="'+e+'" >'+ e +'</option>').appendTo('#deck_select');
        });
        $('#deck_select').prop('disabled', false);
        $('#btn_save').prop('disabled', false);
      });
    }

    if(key == 'anki_deck_models'){
      $('#model_select').empty();
      let deck_model = 'Choose a model';
      chrome.storage.local.get(['deck_model'], (result) => {
        if(result.deck_model != ''){
          deck_model = result.deck_model
        }
        $('<option class="dropdown-item" value="null" >'+ deck_model +'</option>').appendTo('#model_select');

        $('<option class="dropdown-item" value="Default" >'+ 'Default' +'</option>').appendTo('#model_select');
        $('<option class="dropdown-item" value="Classic" >'+ 'Classic' +'</option>').appendTo('#model_select');
        $('<option class="dropdown-item" value="Context" >'+ 'Context' +'</option>').appendTo('#model_select');

        $('#model_select').prop('disabled', false);
        $('#btn_save').prop('disabled', false);
      })

    }

    if(key == 'last_error'){
      if(newValue != ''){
        addErrorNotification(newValue);
        chrome.storage.local.set({last_error: ''});
      }
    }
  }
});

function setBtnToSendAnki(newValue){
  const btn = $('#btn-create');
  if(newValue == 100){
    btn.prop('disabled', false);
    btn.text('Send to Anki');
    btn.attr('data-action', 'send');
    btn.addClass('pulse');
  }else if (newValue == 0 && list_length != 0){
    btn.prop('disabled', false);
    btn.text('Create cards');
    btn.attr('data-action', 'create');
    btn.removeClass('pulse');

    $('#word-list').text('');
    $('#w_check').show();
  }
}

function addErrorNotification(msg){
  $('#alert-section').append('<div class="alert alert-warning">' + msg + '</div>');
}

// --- Clickable --
$('#btn_save').on('click', () => {
  const deck = $('#deck_select').val();
  const model = $('#model_select').val();

  if(deck === "null" && model === "null"){return;}

  chrome.runtime.sendMessage({
    type : 'save_changes',
    data :  {deck : deck, model : model}
  });

  $('#w_options').hide();
});

$('#model_select').change(function() {
  const value = $(this).val();
  $('.txt').hide();
  $('#txt_'+value).show();
});

$('#alert-section').on('click', '.alert' , function() {
  $(this).remove();
});

$('#w_check').on('click', function(){
  $(this).hide();
});

$('#gear').on('click', function(){
  $('#w_options').show();
  $('.txt').hide();

  chrome.runtime.sendMessage({ 
    type : 'options',
    data :  null
  });

});

$('#btn-option-close').on('click', function() {
  $('#w_options').hide();
});

$('#btn-clear').on('click', () => {
  //send to content script
  chrome.tabs.query({
    url: "*://takoboto.jp/*"
  }).then(tabs => sendMessageToTabs(tabs, 'clear'));
  
  chrome.storage.local.set({tako_idList: []});
  chrome.storage.local.set({tako_wordList: []});
  chrome.storage.local.set({downloadState: 0});

  setBtnToSendAnki(0);

  $('#word-list').text('');
});

function sendMessageToTabs(tabs, type) {
    for (let tab of tabs) {
      chrome.tabs.sendMessage(
        tab.id,
        {type: type}
      );
    }
}

// --- Scrapping ---
$('#btn-create').on('click', function() {
  if(list_length == 0){return;}

  $(this).prop('disabled', true);
  if($(this).attr('data-action') == 'create'){
    chrome.runtime.sendMessage({ 
      type : 'scrap',
      data :  null
    });
  }else{
    chrome.runtime.sendMessage({ 
      type : 'send',
      data :  null
    });
  }
});



