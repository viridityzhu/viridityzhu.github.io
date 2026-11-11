// "Rate my coding activity" vote widget.
//
// Counts live in the Waline server shared with the blog (comments.jyzhu.top),
// stored as two reaction counters on a virtual page path:
//   reaction0 = "Productive!"   reaction1 = "Need more coffee"
// (Migrated from LeanCloud in Nov 2026, before its 2027-01-12 shutdown.)
// One vote per browser per day, enforced client-side via localStorage.
document.addEventListener('DOMContentLoaded', function() {
  const API_URL = 'https://comments.jyzhu.top/api/article';
  const VOTE_PATH = '/vote/coding-activity';
  const REACTIONS = { yes: 'reaction0', no: 'reaction1' };
  const LAST_VOTE_DAY_KEY = 'vote-last-vote-day';

  const yesButton = document.getElementById('vote-yes');
  const noButton = document.getElementById('vote-no');
  const yesCountEl = document.getElementById('yes-count');
  const noCountEl = document.getElementById('no-count');
  if (!yesButton || !noButton || !yesCountEl || !noCountEl) return;

  let hasVoted = false;
  let voting = false;

  function getTodayKey() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getLastVoteDay() {
    try {
      return localStorage.getItem(LAST_VOTE_DAY_KEY);
    } catch (error) {
      return null;
    }
  }

  function setLastVoteDay(dayKey) {
    try {
      localStorage.setItem(LAST_VOTE_DAY_KEY, dayKey);
    } catch (error) {
      // Private mode etc.: the vote still counts, it just isn't remembered.
    }
  }

  function showMessage(text) {
    let messageEl = document.getElementById('vote-message');
    if (!messageEl) {
      messageEl = document.createElement('p');
      messageEl.id = 'vote-message';
      messageEl.className = 'vote-message';
      messageEl.setAttribute('aria-live', 'polite');
      const container = document.querySelector('.vote-container');
      if (container) container.appendChild(messageEl);
    }
    messageEl.textContent = text;
    messageEl.classList.add('vote-message--visible');
  }

  function setButtonsDisabled(disabled) {
    yesButton.disabled = disabled;
    noButton.disabled = disabled;
  }

  function renderCounts(counts) {
    yesCountEl.textContent = Number(counts && counts[REACTIONS.yes]) || 0;
    noCountEl.textContent = Number(counts && counts[REACTIONS.no]) || 0;
  }

  async function request(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body.errno) throw new Error(body.errmsg || `errno ${body.errno}`);
    return body.data;
  }

  async function loadCounts() {
    const query = `path=${encodeURIComponent(VOTE_PATH)}` +
      `&type=${encodeURIComponent(Object.values(REACTIONS).join(','))}`;
    const data = await request(`${API_URL}?${query}`);
    renderCounts(Array.isArray(data) ? data[0] : data);
  }

  async function recordVote(type) {
    if (hasVoted || voting) return;
    voting = true;
    setButtonsDisabled(true);

    try {
      await request(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: VOTE_PATH, type: REACTIONS[type], action: 'inc' })
      });
      hasVoted = true;
      setLastVoteDay(getTodayKey());
      showMessage('✓ Thanks for voting today!');
      // Show the vote immediately, then sync with the server's numbers.
      const el = type === 'yes' ? yesCountEl : noCountEl;
      el.textContent = (Number(el.textContent) || 0) + 1;
      loadCounts().catch(function() {});
    } catch (error) {
      console.error('Error recording vote:', error);
      setButtonsDisabled(false);
      showMessage('Vote failed — please try again in a moment.');
    } finally {
      voting = false;
    }
  }

  if (getLastVoteDay() === getTodayKey()) {
    hasVoted = true;
    setButtonsDisabled(true);
    showMessage("✓ You've already voted today — thank you!");
  }

  loadCounts().catch(function(error) {
    console.error('Error getting vote counts:', error);
    // The database may be waking from idle; one retry usually succeeds.
    setTimeout(function() {
      loadCounts().catch(function() {});
    }, 2000);
  });

  yesButton.addEventListener('click', function() {
    recordVote('yes');
  });

  noButton.addEventListener('click', function() {
    recordVote('no');
  });
});
