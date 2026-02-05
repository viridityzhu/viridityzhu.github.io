document.addEventListener('DOMContentLoaded', function() {
  // Initialize LeanCloud
  AV.init({
    appId: "efLA0qg1Vu8kMjj7e1SC6evd-gzGzoHsz",
    appKey: "uexWsXddCqHicPng8NOVKkcN",
    serverURL: "https://efla0qg1.lc-cn-n1-shared.com"
  });
  
  let hasVoted = false;
  const LAST_VOTE_DAY_KEY = 'vote-last-vote-day';
  
  function getLocalDayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  function getTodayKey() {
    return getLocalDayKey(new Date());
  }
  
  function getLastVoteDay() {
    return localStorage.getItem(LAST_VOTE_DAY_KEY);
  }
  
  function setLastVoteDay(dayKey) {
    localStorage.setItem(LAST_VOTE_DAY_KEY, dayKey);
  }
  
  // Create or get a unique user identifier
  function getUserId() {
    let userId = localStorage.getItem('vote-user-id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('vote-user-id', userId);
    }
    return userId;
  }
  
  function ensureMessageEl() {
    let messageEl = document.getElementById('vote-message');
    if (!messageEl) {
      messageEl = document.createElement('p');
      messageEl.id = 'vote-message';
      messageEl.className = 'vote-message';
      messageEl.setAttribute('aria-live', 'polite');
      
      const container = document.querySelector('.vote-container');
      const countEl = document.getElementById('vote-count');
      if (container && countEl && countEl.parentNode === container) {
        container.insertBefore(messageEl, countEl.nextSibling);
      } else if (container) {
        container.appendChild(messageEl);
      }
    }
    return messageEl;
  }
  
  function showMessage(text) {
    const messageEl = ensureMessageEl();
    messageEl.textContent = text;
    messageEl.classList.add('vote-message--visible');
  }
  
  // Check if user has already voted
  async function checkUserVote() {
    const todayKey = getTodayKey();
    if (getLastVoteDay() === todayKey) {
      hasVoted = true;
      disableButtons('already_voted_today');
      return true;
    }
    
    const userId = getUserId();
    try {
      const query = new AV.Query('VoteRecords');
      query.equalTo('deviceId', userId);
      query.equalTo('voteDay', todayKey);
      const result = await query.first();
      hasVoted = !!result;
      if (hasVoted) {
        setLastVoteDay(todayKey);
        disableButtons();
      }
      return hasVoted;
    } catch (error) {
      console.error('Error checking vote status:', error);
      return false;
    }
  }
  
  // Get the current vote counts
  async function getVoteCounts() {
    try {
      const query = new AV.Query('VoteCounter');
      const counter = await query.first();
      
      if (counter) {
        document.getElementById('yes-count').textContent = counter.get('yesCount') || 0;
        document.getElementById('no-count').textContent = counter.get('noCount') || 0;
      } else {
        // Create counter object if it doesn't exist
        const VoteCounter = AV.Object.extend('VoteCounter');
        const newCounter = new VoteCounter();
        
        // Set public read/write ACL
        const acl = new AV.ACL();
        acl.setPublicReadAccess(true);
        acl.setPublicWriteAccess(true);
        newCounter.setACL(acl);
        
        newCounter.set('yesCount', 0);
        newCounter.set('noCount', 0);
        await newCounter.save();
        
        document.getElementById('yes-count').textContent = '0';
        document.getElementById('no-count').textContent = '0';
      }
    } catch (error) {
      console.error('Error getting vote counts:', error);
      document.getElementById('yes-count').textContent = '0';
      document.getElementById('no-count').textContent = '0';
    }
  }
  
  // Record vote and increment counter
  async function recordVote(type) {
    if (hasVoted) return;
    
    const userId = getUserId();
    const todayKey = getTodayKey();
    
    if (getLastVoteDay() === todayKey) {
      hasVoted = true;
      disableButtons('already_voted_today');
      return;
    }
    
    // First check if user has already voted
    try {
      const userQuery = new AV.Query('VoteRecords');
      userQuery.equalTo('deviceId', userId);
      userQuery.equalTo('voteDay', todayKey);
      const existingVote = await userQuery.first();
      
      if (existingVote) {
        hasVoted = true;
        setLastVoteDay(todayKey);
        disableButtons();
        return;
      }
      
      // Find or create counter
      const counterQuery = new AV.Query('VoteCounter');
      let counter = await counterQuery.first();
      
      if (!counter) {
        const VoteCounter = AV.Object.extend('VoteCounter');
        counter = new VoteCounter();
        
        // Set public read/write ACL
        const acl = new AV.ACL();
        acl.setPublicReadAccess(true);
        acl.setPublicWriteAccess(true);
        counter.setACL(acl);
        
        counter.set('yesCount', 0);
        counter.set('noCount', 0);
      }
      
      // Ensure counter has public write access if it already exists
      if (!counter.getACL() || !counter.getACL().getPublicWriteAccess()) {
        const acl = counter.getACL() || new AV.ACL();
        acl.setPublicReadAccess(true);
        acl.setPublicWriteAccess(true);
        counter.setACL(acl);
      }
      
      // Increment the appropriate counter
      if (type === 'yes') {
        counter.increment('yesCount', 1);
      } else {
        counter.increment('noCount', 1);
      }
      
      // Save the counter
      await counter.save();
      
      // Record this user's vote with public read/write permissions
      const VoteRecord = AV.Object.extend('VoteRecords');
      const record = new VoteRecord();
      
      // Set ACL for vote record
      const recordAcl = new AV.ACL();
      recordAcl.setPublicReadAccess(true);
      recordAcl.setPublicWriteAccess(true);
      record.setACL(recordAcl);
      
      record.set('deviceId', userId);
      record.set('voteType', type);
      record.set('voteDay', todayKey);
      await record.save();
      
      // Update UI
      document.getElementById('yes-count').textContent = counter.get('yesCount') || 0;
      document.getElementById('no-count').textContent = counter.get('noCount') || 0;
      
      hasVoted = true;
      setLastVoteDay(todayKey);
      disableButtons('voted_now');
      
    } catch (error) {
      console.error('Error recording vote:', error);
    }
  }
  
  function disableButtons(reason = 'already_voted_today') {
    document.getElementById('vote-yes').disabled = true;
    document.getElementById('vote-no').disabled = true;
    
    if (reason === 'voted_now') {
      showMessage("✓ Thanks for voting today!");
    } else {
      showMessage("✓ You've already voted today — thank you!");
    }
  }
  
  // Initialize
  checkUserVote().then(() => {
    getVoteCounts();
  });
  
  // Add event listeners to buttons
  document.getElementById('vote-yes').addEventListener('click', function() {
    recordVote('yes');
  });
  
  document.getElementById('vote-no').addEventListener('click', function() {
    recordVote('no');
  });
}); 
