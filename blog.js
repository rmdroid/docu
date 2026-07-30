/* docunova Blog — öffentliche PocketBase-Ausgabe und eingeschränkter Redaktionszugang */
(() => {
  'use strict';

  const PB_URL = 'https://db.docunova.de';
  const TOKEN_KEY = 'dn-blog-editor-token';
  const DEFAULT_TITLE = 'Blog — docunova GmbH';
  const DEFAULT_DESCRIPTION = 'Der docunova Blog zu Drucken und Kopieren, Dokumentenmanagement, Büroprozessen und persönlichem IT-Service.';
  const $ = selector => document.querySelector(selector);

  const article = $('#blogArticle');
  const index = $('#blogIndex');
  if (!article || !index) return;

  let publicPosts = [];
  let editorPosts = [];
  let activePost = null;
  let editorToken = sessionStorage.getItem(TOKEN_KEY) || '';
  let slugEdited = false;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const request = async (path, options = {}, token = '') => {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/json');
    if (token) headers.set('Authorization', token);
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${PB_URL}${path}`, { ...options, headers });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  };

  const formatDate = value => {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  const toDateTimeLocal = value => {
    const date = value ? new Date(String(value).replace(' ', 'T')) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  const slugify = value => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);

  const fileUrl = (post, size = '1200x675') => {
    if (!post?.cover_image) return '';
    return `${PB_URL}/api/files/${encodeURIComponent(post.collectionId)}/${encodeURIComponent(post.id)}/${encodeURIComponent(post.cover_image)}?thumb=${encodeURIComponent(size)}`;
  };

  const escapeHtml = text => {
    const node = document.createElement('div');
    node.textContent = text;
    return node.innerHTML;
  };

  const textToHtml = text => String(text || '')
    .trim()
    .split(/\n{2,}/)
    .map(block => {
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      if (!lines.length) return '';
      if (lines.length === 1 && lines[0].startsWith('### ')) {
        return `<h3>${escapeHtml(lines[0].slice(4))}</h3>`;
      }
      if (lines.length === 1 && lines[0].startsWith('## ')) {
        return `<h2>${escapeHtml(lines[0].slice(3))}</h2>`;
      }
      if (lines.every(line => line.startsWith('- '))) {
        return `<ul>${lines.map(line => `<li>${escapeHtml(line.slice(2))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
    })
    .join('');

  const sanitizeHtml = input => {
    if (!/<[a-z][\s\S]*>/i.test(input || '')) return textToHtml(input);

    const doc = new DOMParser().parseFromString(`<body>${input}</body>`, 'text/html');
    const allowed = new Set(['P', 'H2', 'H3', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE', 'BR']);

    Array.from(doc.body.querySelectorAll('*')).forEach(node => {
      if (!allowed.has(node.tagName)) {
        node.replaceWith(...node.childNodes);
        return;
      }

      const href = node.tagName === 'A' ? (node.getAttribute('href') || '') : '';
      Array.from(node.attributes).forEach(attribute => node.removeAttribute(attribute.name));
      if (node.tagName === 'A') {
        if (/^(https?:|mailto:)/i.test(href)) {
          node.setAttribute('href', href);
          node.setAttribute('rel', 'noopener');
        }
      }
    });

    return doc.body.innerHTML;
  };

  const htmlToEditorText = input => {
    if (!/<[a-z][\s\S]*>/i.test(input || '')) return input || '';
    const doc = new DOMParser().parseFromString(`<body>${input}</body>`, 'text/html');
    const blocks = [];

    Array.from(doc.body.children).forEach(node => {
      const text = node.textContent.trim();
      if (!text) return;
      if (node.tagName === 'H2') blocks.push(`## ${text}`);
      else if (node.tagName === 'H3') blocks.push(`### ${text}`);
      else if (node.tagName === 'UL' || node.tagName === 'OL') {
        blocks.push(Array.from(node.querySelectorAll(':scope > li')).map(item => `- ${item.textContent.trim()}`).join('\n'));
      } else blocks.push(text);
    });

    return blocks.join('\n\n') || doc.body.textContent.trim();
  };

  const ensureMeta = (attribute, value, content) => {
    let meta = document.head.querySelector(`meta[${attribute}="${value}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attribute, value);
      document.head.append(meta);
    }
    meta.setAttribute('content', content || '');
  };

  const updateSeo = post => {
    const url = post
      ? `https://docunova.de/blog.html?beitrag=${encodeURIComponent(post.slug)}`
      : 'https://docunova.de/blog.html';
    const title = post ? (post.seo_title || `${post.title} — docunova Blog`) : DEFAULT_TITLE;
    const description = post ? (post.seo_description || post.excerpt) : DEFAULT_DESCRIPTION;
    const image = post ? fileUrl(post) : '';

    document.title = title;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
    ensureMeta('name', 'description', description);
    ensureMeta('property', 'og:type', post ? 'article' : 'website');
    ensureMeta('property', 'og:title', title);
    ensureMeta('property', 'og:description', description);
    ensureMeta('property', 'og:url', url);
    if (image) ensureMeta('property', 'og:image', image);

    let structured = $('#blogStructuredData');
    if (!structured) {
      structured = document.createElement('script');
      structured.id = 'blogStructuredData';
      structured.type = 'application/ld+json';
      document.head.append(structured);
    }
    structured.textContent = JSON.stringify(post ? {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      datePublished: post.published_at || post.created,
      dateModified: post.updated,
      mainEntityOfPage: url,
      image: image || undefined,
      author: { '@type': 'Organization', name: 'docunova GmbH' },
      publisher: { '@type': 'Organization', name: 'docunova GmbH', url: 'https://docunova.de/' }
    } : {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'docunova Blog',
      description: DEFAULT_DESCRIPTION,
      url
    });
  };

  const renderArticle = post => {
    activePost = post;
    article.replaceChildren();

    if (!post) {
      const state = element('div', 'blog-state');
      state.append(element('strong', '', 'Noch keine Beiträge vorhanden.'));
      state.append(document.createTextNode('Schauen Sie bald wieder vorbei.'));
      article.append(state);
      updateSeo(null);
      return;
    }

    const meta = element('div', 'blog-article-meta');
    meta.append(element('span', 'category', post.category || 'docunova'));
    const published = element('time', '', formatDate(post.published_at || post.created));
    published.dateTime = post.published_at || post.created || '';
    meta.append(published);

    const title = element('h2', 'blog-title', post.title);
    const deck = element('p', 'blog-deck', post.excerpt);
    article.append(meta, title, deck);

    const image = fileUrl(post);
    if (image) {
      const cover = element('img', 'blog-cover');
      cover.src = image;
      cover.alt = post.title;
      cover.width = 1200;
      cover.height = 675;
      cover.loading = 'eager';
      cover.decoding = 'async';
      article.append(cover);
    }

    const content = element('div', 'blog-content');
    content.innerHTML = sanitizeHtml(post.content || '');
    article.append(content);
    updateSeo(post);
  };

  const renderIndex = () => {
    index.replaceChildren();
    publicPosts.forEach((post, position) => {
      const item = element('li');
      const button = element('button');
      button.type = 'button';
      button.dataset.slug = post.slug;
      button.setAttribute('aria-current', String(post.id === activePost?.id));
      button.append(
        element('span', 'index-no', `${String(position + 1).padStart(2, '0')} · ${formatDate(post.published_at || post.created)}`),
        element('span', 'index-title', post.title)
      );
      button.addEventListener('click', () => selectPost(post, true));
      item.append(button);
      index.append(item);
    });
  };

  const selectPost = (post, updateHistory) => {
    renderArticle(post);
    renderIndex();
    if (updateHistory) {
      const url = new URL(window.location.href);
      url.searchParams.set('beitrag', post.slug);
      history.pushState({ slug: post.slug }, '', url);
      article.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const loadPublicPosts = async () => {
    try {
      const params = new URLSearchParams({ page: '1', perPage: '100', sort: '-published_at,-created' });
      const result = await request(`/api/collections/posts/records?${params}`);
      publicPosts = result.items || [];
      const slug = new URLSearchParams(location.search).get('beitrag');
      const selected = publicPosts.find(post => post.slug === slug) || publicPosts[0] || null;
      if (selected && !slug) {
        const url = new URL(window.location.href);
        url.searchParams.set('beitrag', selected.slug);
        history.replaceState({ slug: selected.slug }, '', url);
      }
      renderArticle(selected);
      renderIndex();
    } catch {
      article.innerHTML = '<div class="blog-state"><strong>Die Beiträge sind gerade nicht erreichbar.</strong>Bitte versuchen Sie es später noch einmal.</div>';
      index.innerHTML = '<li><span class="blog-state">Keine Verbindung</span></li>';
    }
  };

  window.addEventListener('popstate', () => {
    const slug = new URLSearchParams(location.search).get('beitrag');
    selectPost(publicPosts.find(post => post.slug === slug) || publicPosts[0] || null, false);
  });

  /* Redaktionsbereich */
  const admin = $('#blogAdmin');
  const loginForm = $('#blogLogin');
  const loginStatus = $('#blogLoginStatus');
  const editor = $('#blogEditor');
  const editorStatus = $('#blogEditorStatus');
  const postForm = $('#blogPostForm');
  const picker = $('#blogPostPicker');
  const fields = {
    id: $('#blogPostId'),
    title: $('#blogPostTitle'),
    slug: $('#blogPostSlug'),
    category: $('#blogPostCategory'),
    excerpt: $('#blogPostExcerpt'),
    content: $('#blogPostContent'),
    date: $('#blogPostDate'),
    image: $('#blogPostImage'),
    seoTitle: $('#blogPostSeoTitle'),
    seoDescription: $('#blogPostSeoDescription'),
    published: $('#blogPostPublished')
  };
  const deleteButton = $('#blogDeletePost');

  const setStatus = (node, message = '', error = false) => {
    node.textContent = message;
    node.classList.toggle('error', error);
  };

  const showLogin = () => {
    loginForm.hidden = false;
    editor.hidden = true;
  };

  const showEditor = () => {
    loginForm.hidden = true;
    editor.hidden = false;
  };

  const resetEditor = () => {
    postForm.reset();
    fields.id.value = '';
    fields.date.value = toDateTimeLocal(new Date());
    deleteButton.hidden = true;
    slugEdited = false;
    setStatus(editorStatus);
  };

  const fillEditor = post => {
    fields.id.value = post.id;
    fields.title.value = post.title || '';
    fields.slug.value = post.slug || '';
    fields.category.value = post.category || '';
    fields.excerpt.value = post.excerpt || '';
    fields.content.value = htmlToEditorText(post.content || '');
    fields.date.value = toDateTimeLocal(post.published_at || post.created);
    fields.seoTitle.value = post.seo_title || '';
    fields.seoDescription.value = post.seo_description || '';
    fields.published.checked = !!post.published;
    fields.image.value = '';
    deleteButton.hidden = false;
    slugEdited = true;
    setStatus(editorStatus, post.cover_image ? 'Ein Titelbild ist vorhanden. Ein neues Bild ersetzt es.' : '');
  };

  const loadEditorPosts = async () => {
    try {
      const params = new URLSearchParams({ page: '1', perPage: '200', sort: '-published_at,-created' });
      const result = await request(`/api/collections/posts/records?${params}`, {}, editorToken);
      editorPosts = result.items || [];
      picker.innerHTML = '<option value="">Neuen Beitrag anlegen</option>';
      editorPosts.forEach(post => {
        const option = element('option', '', `${post.published ? '●' : '○'} ${post.title}`);
        option.value = post.id;
        picker.append(option);
      });
      showEditor();
      resetEditor();
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        editorToken = '';
        sessionStorage.removeItem(TOKEN_KEY);
        showLogin();
        setStatus(loginStatus, 'Bitte melden Sie sich erneut an.', true);
        return;
      }
      setStatus(editorStatus, 'Die Beiträge konnten nicht geladen werden.', true);
    }
  };

  $('#blogAdminOpen')?.addEventListener('click', () => {
    admin.showModal();
    if (editorToken) loadEditorPosts();
    else showLogin();
  });
  $('#blogAdminClose')?.addEventListener('click', () => admin.close());
  admin?.addEventListener('click', event => {
    if (event.target === admin) admin.close();
  });

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = loginForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    setStatus(loginStatus, 'Anmeldung wird geprüft …');
    try {
      const data = await request('/api/collections/blog_editors/auth-with-password', {
        method: 'POST',
        body: JSON.stringify({
          identity: $('#blogLoginEmail').value.trim(),
          password: $('#blogLoginPassword').value
        })
      });
      if (!data.record?.active) throw new Error('inactive');
      editorToken = data.token;
      sessionStorage.setItem(TOKEN_KEY, editorToken);
      loginForm.reset();
      setStatus(loginStatus);
      await loadEditorPosts();
    } catch {
      setStatus(loginStatus, 'E-Mail-Adresse oder Passwort sind nicht korrekt.', true);
    } finally {
      submit.disabled = false;
    }
  });

  $('#blogLogout')?.addEventListener('click', () => {
    editorToken = '';
    sessionStorage.removeItem(TOKEN_KEY);
    resetEditor();
    showLogin();
  });

  $('#blogNewPost')?.addEventListener('click', () => {
    picker.value = '';
    resetEditor();
    fields.title.focus();
  });

  $('#blogLoadPost')?.addEventListener('click', () => {
    const post = editorPosts.find(item => item.id === picker.value);
    if (post) fillEditor(post);
    else resetEditor();
  });

  picker?.addEventListener('change', () => {
    const post = editorPosts.find(item => item.id === picker.value);
    if (post) fillEditor(post);
    else resetEditor();
  });

  fields.slug?.addEventListener('input', () => { slugEdited = true; });
  fields.title?.addEventListener('input', () => {
    if (!slugEdited && !fields.id.value) fields.slug.value = slugify(fields.title.value);
  });

  postForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!postForm.reportValidity()) return;

    const saveButton = $('#blogSavePost');
    const file = fields.image.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      setStatus(editorStatus, 'Das Titelbild darf höchstens 5 MB groß sein.', true);
      return;
    }

    const formData = new FormData();
    formData.set('title', fields.title.value.trim());
    formData.set('slug', slugify(fields.slug.value));
    formData.set('category', fields.category.value);
    formData.set('excerpt', fields.excerpt.value.trim());
    formData.set('content', fields.content.value.trim());
    formData.set('published', String(fields.published.checked));
    formData.set('published_at', fields.date.value ? new Date(fields.date.value).toISOString() : '');
    formData.set('seo_title', fields.seoTitle.value.trim());
    formData.set('seo_description', fields.seoDescription.value.trim());
    if (file) formData.set('cover_image', file, file.name);

    saveButton.disabled = true;
    setStatus(editorStatus, 'Beitrag wird gespeichert …');
    try {
      const id = fields.id.value;
      const saved = await request(`/api/collections/posts/records${id ? `/${encodeURIComponent(id)}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        body: formData
      }, editorToken);
      fields.id.value = saved.id;
      setStatus(editorStatus, 'Beitrag wurde gespeichert.');
      await Promise.all([loadEditorPosts(), loadPublicPosts()]);
      picker.value = saved.id;
      const refreshed = editorPosts.find(item => item.id === saved.id);
      if (refreshed) fillEditor(refreshed);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        editorToken = '';
        sessionStorage.removeItem(TOKEN_KEY);
        showLogin();
        setStatus(loginStatus, 'Die Anmeldung ist abgelaufen. Bitte erneut anmelden.', true);
      } else {
        const slugError = error.data?.data?.slug ? ' Das URL-Kürzel ist möglicherweise bereits vergeben.' : '';
        setStatus(editorStatus, `Der Beitrag konnte nicht gespeichert werden.${slugError}`, true);
      }
    } finally {
      saveButton.disabled = false;
    }
  });

  deleteButton?.addEventListener('click', async () => {
    const id = fields.id.value;
    if (!id || !window.confirm('Diesen Beitrag wirklich löschen?')) return;
    deleteButton.disabled = true;
    try {
      await request(`/api/collections/posts/records/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      }, editorToken);
      await Promise.all([loadEditorPosts(), loadPublicPosts()]);
      setStatus(editorStatus, 'Beitrag wurde gelöscht.');
    } catch {
      setStatus(editorStatus, 'Der Beitrag konnte nicht gelöscht werden.', true);
    } finally {
      deleteButton.disabled = false;
    }
  });

  loadPublicPosts();
})();
