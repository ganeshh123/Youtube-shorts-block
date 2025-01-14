let isEnable=true;
let isHideTabs=false;
let isHideVideos=false;

let observer=null;
const defaultSelector = `div#contents.style-scope.ytd-section-list-renderer`
const videoGridSelector = `div#items.style-scope.ytd-grid-renderer`
const recommendedListSelector = `#related.style-scope.ytd-watch-flexy`

// https://stackoverflow.com/posts/29754070/revisions
const waitForElement = (selector, callback, checkFrequencyInMs, timeoutInMs) => {
    const startTimeInMs = Date.now();
    const loopSearch = () => {
      if (document.querySelector(selector) != null) {
        callback();
        return;
      }
      else {
        setTimeout(function () {
          if (timeoutInMs && Date.now() - startTimeInMs > timeoutInMs)
            return;
          loopSearch();
        }, checkFrequencyInMs);
      }
    }
    loopSearch();
}

function uriCheck(_uri){
    let links=_uri.split("/");
    for(let i=0;i<links.length;i++){
        if(links[i]=="shorts"){
            return "https://www.youtube.com/watch?v="+links[i+1];
        }
    }
    return null;
}

function loadSettings(){
    chrome.storage.local.get(null, function(value){
        //有効/無効
        if(value.isEnable!==false){
            isEnable=true;
        } else {
            isEnable=false;
        }

        //ビデオを非表示
        if(value.isHideVideos===true){
            isHideVideos=true;
        }else{
            isHideVideos=false;
        }
        observeShorts();

        if(value.isHideTabs===true){
            isHideTabs=true;
        }else{
            isHideTabs=false;
        }
        
        if(isHideTabs){
            document.body.classList.add("youtube-shorts-block");
        }else{
            document.body.classList.remove("youtube-shorts-block");
        }
    });
}

const attachObserver = (selector) => {
    if(observer){
        waitForElement(selector, () => {
            removeShortVideo()
            observer.observe(document.querySelector(selector), {childList:true, subtree:true})
        }, undefined, 10000)
    }
}

const attachAllObservers = () => {
    if(observer){
        observer.disconnect()
    }
    attachObserver(defaultSelector)
    attachAllObservers(videoGridSelector)
    attachAllObservers(recommendedListSelector)
}

const attachRelevantObservers = (basURI) => {
    // Only attach relevant observers depending on page
    if(observer){
        observer.disconnect()
    }
    if(basURI.includes('shorts') || basURI.includes('watch')){
        // Watch Page
        attachObserver(recommendedListSelector)
    }
    if(basURI.includes('/videos') && (basURI.includes('/c/') || basURI.includes('/channel/'))){
        // Channel Videos Page
        attachObserver(videoGridSelector)
    }
    if(basURI.includes('/feed/subscriptions')                   // Subscriptions Page
    || (basURI.includes('/c/') && basURI.includes('/featured')) // Main Channel Page
    || basURI.includes('results')                               // Search Results Page
    || basURI.includes('playlist')                              // Playlist Page
    ){
        attachObserver(defaultSelector)
    }
}

function observeShorts(){
    if(observer===null && isEnable && isHideVideos){
        //---Warning--- This function is called so often that it could be affecting performance! Please "pull request"!
        //---警告--- この機能は頻繁に呼び出されており、パフォーマンスに影響があることが考えられます！プルリクエストを！
        observer=new MutationObserver(removeShortVideo);
        attachRelevantObservers(window.location.href)
    }
    if(observer!==null && (isEnable===false || isHideVideos===false)){
        observer.disconnect();
        observer=null;
    }
}

function removeShortVideo(mutations){
    if(mutations){
        // For performance, check if the mutation actually involved the insertion of 
        // new elements, otherwise dont do anything
        let elementsChanged = false
        for(const m of mutations){
            if(m.type === 'childList' && m.addedNodes.length){
                const validNewElements = [
                    'YTD-ITEM-SECTION-RENDERER', // Item Sections
                    'YTD-GRID-VIDEO-RENDERER',   // New Video Items
                    'YTD-COMPACT-VIDEO-RENDERER' // Recommended Video Items
                ]
                for(const node of m.addedNodes){
                    if(validNewElements.includes(node.nodeName)){
                        elementsChanged = true
                        break
                    }
                }
            }
        }
        if(elementsChanged === false){
            return
        }
    }

    let videoArray=document.querySelectorAll("ytd-video-renderer ytd-thumbnail a, ytd-grid-video-renderer ytd-thumbnail a");
    videoArray.forEach(e=>{
        if(e.href.indexOf("shorts")!=-1){
            let x=e.parentNode;
            while(true){
                if(x.tagName=="YTD-VIDEO-RENDERER" || x.tagName=="YTD-GRID-VIDEO-RENDERER"){x.remove();break;}
                if(x)
                x=x.parentNode;
                if(x===null)break;
            }
        }
    });

    // Remove persisting spinner dividers
    const spinnerDividers = Array.from(document.querySelectorAll('ytd-continuation-item-renderer'))
    for(const sD of spinnerDividers){
        // Remove any spinning dividers after videos have loaded under them (they have a sibling element)
        if(sD.nextElementSibling){
            sD.remove()
        }
    }
    return
}

document.addEventListener("yt-navigate-start",function(event){
    let basURI=event.target.baseURI;
    let normalURI=uriCheck(basURI);
    if(normalURI!==null && isEnable){
        history.back();
        location=normalURI;
    }
    attachRelevantObservers(basURI)
});

chrome.storage.onChanged.addListener(function(){
    loadSettings();
});

//初期化
loadSettings();
let uri=uriCheck(location.href);
if(uri!==null && isEnable){
    location=uri;
}