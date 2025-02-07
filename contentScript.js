function log(message)
{
    console.log("Devine Dismisser: " + message)
}

// === Naive Bayes Classifier Implementation ===
class NaiveBayesClassifier {
    constructor() {
      // Map label -> { count: Number, wordCounts: { word: count } }
      this.classes = {};
      this.vocabulary = new Set();
      this.totalDocs = 0;
    }
    
    // Basic tokenization: convert to lowercase, split on non-word characters, and filter out empty strings.
    tokenize(text) {
      return text.toLowerCase().split(/\W+/).filter(Boolean);
    }
    
    // Add a document with an associated label to the training data.
    addDocument(text, label) {
      const words = this.tokenize(text);
      if (!this.classes[label]) {
        this.classes[label] = { count: 0, wordCounts: {} };
      }
      this.classes[label].count++;
      this.totalDocs++;
      for (const word of words) {
        this.vocabulary.add(word);
        if (!this.classes[label].wordCounts[word]) {
          this.classes[label].wordCounts[word] = 0;
        }
        this.classes[label].wordCounts[word]++;
      }
    }
    
    // Calculate the probability of a word given a label using Laplace smoothing.
    wordProb(word, label) {
      const wordCount = this.classes[label].wordCounts[word] || 0;
      const totalWords = Object.values(this.classes[label].wordCounts)
                                .reduce((sum, cnt) => sum + cnt, 0);
      const vocabSize = this.vocabulary.size;
      return (wordCount + 1) / (totalWords + vocabSize);
    }
    
    // Classify a given text and return the label with the highest (log) probability.
    classify(text) {
      const words = this.tokenize(text);
      let maxLabel = null;
      let maxLogProb = -Infinity;
      for (const label in this.classes) {
        // Start with the log prior probability.
        let logProb = Math.log(this.classes[label].count / this.totalDocs);
        for (const word of words) {
          logProb += Math.log(this.wordProb(word, label));
        }
        if (logProb > maxLogProb) {
          maxLogProb = logProb;
          maxLabel = label;
        }
      }
      return maxLabel;
    }
    
    // Serialize the classifier to JSON.
    toJSON() {
      return {
        classes: this.classes,
        vocabulary: Array.from(this.vocabulary),
        totalDocs: this.totalDocs
      };
    }
    
    // Reconstruct a classifier from JSON data.
    static fromJSON(data) {
      const classifier = new NaiveBayesClassifier();
      classifier.classes = data.classes;
      classifier.vocabulary = new Set(data.vocabulary);
      classifier.totalDocs = data.totalDocs;
      return classifier;
    }
  }
  
  // === Caching Helpers Using localStorage ===
  
  // Attempt to load a cached classifier from localStorage.
  function loadClassifier() {
    const cached = localStorage.getItem('classifier');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        return NaiveBayesClassifier.fromJSON(data);
      } catch (e) {
        console.error('Error parsing cached classifier:', e);
      }
    }
    return null;
  }
  
  // Save the classifier to localStorage.
  function saveClassifier(classifier) {
    const data = classifier.toJSON();
    localStorage.setItem('classifier', JSON.stringify(data));
  }

function loadTrainingData() 
{
    // Define the mapping: label -> filename
    const trainingFiles = 
    {
      'theist': 'training data/training_theist.txt',
      'anti-theist': 'training_anti_theist.txt',
      'neutral': 'training_neutral.txt'
    };
  
    // For each file, fetch its contents and split into lines.
    const promises = [];
    for (const label in trainingFiles) {
      const url = chrome.runtime.getURL(trainingFiles[label]);
      const promise = fetch(url)
        .then(response => response.text())
        .then(text => {
          const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          return { label, lines };
        });
      promises.push(promise);
    }
    return Promise.all(promises);
  }

async function trainClassifierFromFiles() 
{
    const trainingData = await loadTrainingData();
    const classifier = new NaiveBayesClassifier();
    trainingData.forEach(data => 
    {
      data.lines.forEach(line => 
        {
            classifier.addDocument(line, data.label);
        });
    });
    saveClassifier(classifier);
    return classifier;
  }

  // Retrieve a classifier from cache if available; otherwise, train a new one.
  //let classifier = loadClassifier();
  //if (!classifier) 
  //{
  //  classifier = trainClassifier();
  //  log('Trained new classifier and cached it.');
  //} 
  //else 
  //{
  //  log('Loaded classifier from cache.');
  //}
  
  function processInitialContent() {
    document.querySelectorAll('ytd-comment-renderer').forEach(processComment);
    document.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer').forEach(processVideo);
  }
  
  // Set up a MutationObserver to process dynamically added content.
  function setupMutationObserver() {
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          
          // Check for comment renderers.
          if (node.matches && node.matches('ytd-comment-renderer')) {
            processComment(node);
          }
          const commentRenderers = node.querySelectorAll && node.querySelectorAll('ytd-comment-renderer');
          commentRenderers && commentRenderers.forEach(processComment);
          
          // Check for video renderers.
          if (node.matches && node.matches('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer')) {
            processVideo(node);
          }
          const videoRenderers = node.querySelectorAll && node.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer');
          videoRenderers && videoRenderers.forEach(processVideo);
        });
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }



  // === YouTube Content Blocking Functions ===
  
  // Process a comment element. Use the classifier to decide whether to hide it.
  // Only block content if it is classified as "theist".
  function processComment(commentRenderer) {
    const commentTextElement = commentRenderer.querySelector('#content-text');
    if (commentTextElement) {
      const text = commentTextElement.innerText;
      const label = classifier.classify(text);
      if (label === 'theist') {
        commentRenderer.style.display = 'none';
        log('Blocked a theist comment:' + text);
      }
    }
  }
  
  // Process a video recommendation element.
  // Only hide the element if its title is classified as "theist".
  function processVideo(videoElement) {
    const titleElement = videoElement.querySelector('#video-title');
    if (titleElement) {
      const text = titleElement.innerText;
      const label = classifier.classify(text);
      if (label === 'theist') {
        videoElement.style.display = 'none';
        log('Blocked a theist video:' + text);
      }
    }
  }

  function loadClassifier() {
    const cached = localStorage.getItem('classifier');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        return NaiveBayesClassifier.fromJSON(data);
      } catch (e) {
        console.error('Error parsing cached classifier:', e);
      }
    }
    return null;
  }
  

let classifier = loadClassifier();
(async function init()
{
  classifier = await trainClassifierFromFiles();

  processInitialContent();
  setupMutationObserver();
})

// === Initial Processing on Page Load ===
log("started")

// Process already-loaded comment elements.
document.querySelectorAll('ytd-comment-renderer').forEach(processComment);
  
// Process video items on the page (e.g., recommendations, search results).
document.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer').forEach(processVideo);

const observer = new MutationObserver(mutations => 
  {
    mutations.forEach(mutation =>
    {
      mutation.addedNodes.forEach(node => 
      {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        
        // Process comments.
        if (node.matches && node.matches('ytd-comment-renderer')) 
        {
            processComment(node);
        }
        const commentRenderers = node.querySelectorAll && node.querySelectorAll('ytd-comment-renderer');
        if (commentRenderers && commentRenderers.length) 
        {
          commentRenderers.forEach(processComment);
        }
                    
        // Process video items.
        if (node.matches && node.matches('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer')) 
        {
          processVideo(node);
        }
        const videoRenderers = node.querySelectorAll && node.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer');
        if (videoRenderers && videoRenderers.length) 
        {
            videoRenderers.forEach(processVideo);
        }

      });
    });
  });

//const observer = new MutationObserver(mutations => 
//    {
//        mutations.forEach(mutation => 
//        {
//            mutation.addedNodes.forEach(node => 
//            {
//                if (node.nodeType !== Node.ELEMENT_NODE) return;
//            
//                // Process comments.
//                if (node.matches && node.matches('ytd-comment-renderer')) 
//                {
//                    processComment(node);
//                }
//                const commentRenderers = node.querySelectorAll && node.querySelectorAll('ytd-comment-renderer');
//                if (commentRenderers && commentRenderers.length) 
//                {
//                  commentRenderers.forEach(processComment);
//                }
//            
//            // Process video items.
//            if (node.matches && node.matches('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer')) 
//            {
//              processVideo(node);
//            }
//            const videoRenderers = node.querySelectorAll && node.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer');
//            if (videoRenderers && videoRenderers.length) 
//            {
//                videoRenderers.forEach(processVideo);
//            }
//          });
//        });
//    }
//
//// Start observing the document body for added nodes.
observer.observe(document.body, { childList: true, subtree: true });