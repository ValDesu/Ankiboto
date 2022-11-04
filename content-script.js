let currentIdList = [];

let btnEnable = '';
let btnDisable = '';

function handleResultShowing(result){

  let children = result.children();

  let id = children.eq(0).attr('value');
  let word = children.eq(1).first().text();

  let btnAnki;

  if($.inArray(id, currentIdList) == -1){
    btnAnki = $('<a/>').text('add to list').attr({
      'class' : 'btn-anki',
      'style' : btnEnable,
      'data-word' : word,
      'data-id' : id,
    });
  }else{
    btnAnki = $('<a/>').text('added ✔️').attr({
      'class' : 'btn-anki btn-anki-dis',
      'style' : btnDisable,
      'data-word' : word,
      'data-id' : id,
    });
  }

  result.wrap("<div class='wrapper-result'></div>");
  $(btnAnki).prependTo(result.parent());
}




$( document ).ready(function() {
  if($('body').css('background-color') == 'rgb(255, 255, 255)'){
    btnDisable = 'user-select: none;margin:10px;cursor:default;font-size:12px;float:right;text-decoration:none;display:inline-block;padding:5px 10px 5px 10px;background-color:#b2ff6c; color:green;border-radius:5px;-moz-border-radius:5px';
    btnEnable = 'user-select: none;margin:10px;cursor:pointer;font-size:12px;float:right;text-decoration:none;display:inline-block;padding:5px 10px 5px 10px;background-color:#CADDFF;border-radius:5px;-moz-border-radius:5px';
  }else{
    btnDisable = 'user-select: none;margin:10px;cursor:default;font-size:12px;float:right;text-decoration:none;display:inline-block;padding:5px 10px 5px 10px;background-color:#233018; color:#13b313;border-radius:5px;-moz-border-radius:5px';
    btnEnable = 'user-select: none;margin:10px;cursor:pointer;font-size:12px;float:right;text-decoration:none;display:inline-block;padding:5px 10px 5px 10px;background-color:#203050;border-radius:5px;-moz-border-radius:5px';
  }

  chrome.storage.local.get(['tako_idList'], function(response) {
    if(response['tako_idList'] == undefined){
      currentIdList = [];
    }else{
      currentIdList = response['tako_idList'];
    }
  
    $("#SearchResultContent").unbindArrive();
  
    let result = $("#SearchResultContent").children();
    result.each(function(index) {
      if(!index == 0){handleResultShowing($(this));}
    });
  
    bindArrive('#SearchResultContent', '.ResultDiv' );

  });

});

function bindArrive(container, elmnt) {
  $(container).arrive(elmnt, function(){
    handleResultShowing($(this));
  });
}

$("#SearchResultContent").delegate('.btn-anki', 'click', function(e) {
  let word = $(this).attr('data-word');
  let id = $(this).attr('data-id');

  chrome.storage.local.get(['tako_idList'], function(result) {
    let value = result.tako_idList;
    value.push(id);
    chrome.storage.local.set({tako_idList: value}, function() {
      console.log(value);
    });
  });

  chrome.storage.local.get(['tako_wordList'], function(result) {
    let value = result.tako_wordList;
    value.push(word);
    chrome.storage.local.set({tako_wordList: value}, function() {
      console.log(value);
    });
  });

  $(this).prop('disabled', true);
  $(this).addClass('btn-anki-dis');
  $(this).text('added ✔️');
  $(this).attr('style', btnDisable,
  );
 
});

function resetAllButtons(){
  $('.btn-anki-dis').each(function() {
    console.log('btn reable');
    $(this).prop('disabled', false);
    $(this).text('add to list');
    $(this).attr('style',btnEnable);
    $(this).removeClass('btn-anki-dis');
  });
}

// Message listening ----

chrome.runtime.onMessage.addListener((m) => {
  if(m.type == 'clear'){
    resetAllButtons();
  }
  return true;
});