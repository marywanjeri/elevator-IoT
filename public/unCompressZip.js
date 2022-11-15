const elevatorModelTag = document.querySelector("#elevatorModelTag");
var zip = new JSZip();

async function getGLBFile() {///from zipped file
    var fileLocation = "assets/elevator_final.zip"; 
    console.log('Uncompressing zip file: ' + fileLocation);
    await fetch(fileLocation) ///Loads a file that it is in the same sub-directory as the code
        .then(res => res.blob()) ///cached file
        .then(blob =>{ 
            zip.loadAsync(blob).then(function (zip) {
            
                Object.keys(zip.files).forEach(function (filename) {
                    console.log('Output: ' +filename);
                    zip.files[filename].async('blob').then(function (fileBlob) {
                        var url = URL.createObjectURL(fileBlob);
                        // console.log(fileBlob);
                        var cacheURL = String(url);  
                        // console.log('Blob URL is ' +cacheURL); ///Format is ''blob:http://....:port/...'
                        updateSrcs(filename,cacheURL,fileBlob);
                        // elevatorModelTag.src=cacheURL;
                        setTimeout(() => {
                            URL.revokeObjectURL(url); ///remove to avoid leaks,, .glb file needs more time to load hence the timeout given
                        }, 10000);   
                    });
                });
            },function() {
                alert('Not a Valid Zip File');
            });
        }
    );
  }

  function updateSrcs(fileName, cacheURL,fileBlob) {
    if(cacheURL == null) return;
    if(fileName == "elevator_final/elevator_final.glb"){
      elevatorModelTag.src=cacheURL;
      elevatorModelTag.iosSrc=cacheURL;
    }
    else if(fileName == "elevator_final/modelViewerScript.js"){
        const b = fileBlob.slice(0, fileBlob.size, "text/javascript");
        const c= URL.createObjectURL(b);
        addScriptFile(c);
        URL.revokeObjectURL(c); ///remove to avoid leaks
    }
  }

  function addScriptFile(cacheFileURL) { ///This is how to add a new script file
    var modelViewerScript = document.createElement('script');
    modelViewerScript.src = cacheFileURL;
    modelViewerScript.type = "module";
    document.getElementsByTagName("body")[0].appendChild(modelViewerScript);///add a new script in body section of HTML coed
    // document.body.appendChild(modelViewerScript);///add a new script in body section of HTML coed
  }