const state = {
  feeds: [],
  posts: []
};

const form = document.getElementById('rss-form');
const urlInput = document.getElementById('rss-url');
const errorMessage = document.getElementById('error-message');
const feedsList = document.getElementById('feeds-list');
const postsList = document.getElementById('posts-list');
const postModal = new bootstrap.Modal(document.getElementById('postModal'));

const schema = yup.object({
  url: yup.string()
    .url('Некорректный URL')
    .required('Введите URL')
});

async function parseRSS(url) {
  const proxy = 'https://api.allorigins.win/get?url=';
  
  const response = await axios.get(proxy + encodeURIComponent(url));
  
  if (response.data.status !== 'ok') {
    throw new Error('Ошибка загрузки');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(response.data.contents, 'text/xml');

  const parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Невалидный RSS');
  }

  const channel = xmlDoc.querySelector('channel');
  const feed = {
    id: Date.now(),
    title: channel.querySelector('title')?.textContent || 'Без названия',
    description: channel.querySelector('description')?.textContent || '',
    link: url
  };

  const items = Array.from(xmlDoc.querySelectorAll('item')).map((item, index) => ({
    id: `${feed.id}-${index}`,
    title: item.querySelector('title')?.textContent || 'Без заголовка',
    description: item.querySelector('description')?.textContent || '',
    link: item.querySelector('link')?.textContent || '#',
    feedId: feed.id,
    isRead: false,
    pubDate: item.querySelector('pubDate')?.textContent || ''
  }));

  return { feed, posts: items };
}

function renderFeeds() {
  feedsList.innerHTML = state.feeds.map(feed => `
    <li class="list-group-item">
      <strong>${escapeHtml(feed.title)}</strong>
      <small class="text-muted d-block">${escapeHtml(feed.description.substring(0, 50))}...</small>
    </li>
  `).join('');
}

function renderPosts() {
  const sortedPosts = [...state.posts].sort((a, b) => 
    new Date(b.pubDate || 0) - new Date(a.pubDate || 0)
  );

  postsList.innerHTML = sortedPosts.map(post => `
    <li class="list-group-item ${post.isRead ? 'read' : 'unread'}" 
        data-post-id="${post.id}">
      <div class="d-flex w-100 justify-content-between">
        <h6 class="mb-1">${escapeHtml(post.title)}</h6>
        <small>${formatDate(post.pubDate)}</small>
      </div>
      <p class="mb-1 text-muted small">${escapeHtml(post.description.substring(0, 100))}...</p>
    </li>
  `).join('');

  document.querySelectorAll('#posts-list .list-group-item').forEach(item => {
    item.addEventListener('click', () => openPostModal(item.dataset.postId));
  });
}

function openPostModal(postId) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;

  post.isRead = true;
  renderPosts();

  document.getElementById('modal-title').textContent = post.title;
  document.getElementById('modal-body').innerHTML = `
    <p>${escapeHtml(post.description)}</p>
    <small class="text-muted">Источник: ${getFeedTitle(post.feedId)}</small>
  `;
  document.getElementById('modal-link').href = post.link;
  
  postModal.show();
}

async function checkUpdates() {
  for (const feed of state.feeds) {
    try {
      const { posts: newPosts } = await parseRSS(feed.link);
      
      const existingLinks = new Set(state.posts.map(p => p.link));
      const uniquePosts = newPosts.filter(p => !existingLinks.has(p.link));

      if (uniquePosts.length > 0) {
        state.posts = [...uniquePosts, ...state.posts];
        renderPosts();
        console.log(`Добавлено ${uniquePosts.length} новых постов`);
      }
    } catch (e) {
      console.error('Ошибка обновления:', e.message);
    }
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMessage.textContent = '';
  
  const url = urlInput.value.trim();
  
  try {
    await schema.validate({ url });
    
    if (state.feeds.some(f => f.link === url)) {
      throw new Error('Этот RSS уже добавлен');
    }

    const { feed, posts } = await parseRSS(url);
    
    state.feeds.push(feed);
    state.posts = [...posts, ...state.posts];
    
    renderFeeds();
    renderPosts();
    urlInput.value = '';
    
  } catch (error) {
    errorMessage.textContent = error.message;
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getFeedTitle(feedId) {
  const feed = state.feeds.find(f => f.id === feedId);
  return feed ? feed.title : 'Неизвестно';
}

setInterval(checkUpdates, 5000);

console.log('RSS Агрегатор запущен!');