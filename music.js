// Tailwind 配置 - 在JS中配置Tailwind
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: '#6366f1',
                secondary: '#f472b6',
                dark: {
                    100: '#1e293b',
                    200: '#0f172a',
                    300: '#020617'
                }
            }
        }
    }
}


// 使用Meting API获取歌单（已验证该API格式）
const METING_API = 'https://api.injahow.cn/meting/?server=netease&type=playlist&id=';
// 用于获取歌单详情（包括名称）的API
const PLAYLIST_DETAIL_API = 'https://api.injahow.cn/meting/?server=netease&type=detail&id=';

// 歌曲播放地址模板 - 网易云官方外链格式
const SONG_PLAY_URL = 'https://music.163.com/song/media/outer/url?id=';

// 歌曲数据 - 按歌单组织
let playlists = {
    all: {
        id: 'all',
        name: '全部歌曲',
        songs: [],
        description: '所有已加载歌单的歌曲集合'
    }
};
let currentPlaylistId = 'all'; // 默认显示全部歌曲
let currentSongIndex = -1;
let isShuffle = false;
let isRepeat = false;
let previousSongIndex = -1;
let autoLoadComplete = false;

// DOM 元素
const audioPlayer = document.getElementById('audio-player');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const progressBar = document.getElementById('progress-bar');
const volumeBar = document.getElementById('volume-bar');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const audioWave = document.getElementById('audio-wave');
const vinylContainer = document.getElementById('vinyl-container');
const currentSongTitle = document.getElementById('current-song-title');
const currentSongArtist = document.getElementById('current-song-artist');
const currentPlaylistName = document.getElementById('current-playlist-name');
const playlistTabs = document.getElementById('playlist-tabs');
const playlistsContainer = document.getElementById('playlists-container');
const currentPlaylistDisplayTitle = document.getElementById('current-playlist-display-title');
const currentPlaylistDisplayCount = document.getElementById('current-playlist-display-count');
const allSongsPlaylist = document.getElementById('all-songs-playlist');
const albumCover = document.getElementById('album-cover');
const themeToggle = document.getElementById('theme-toggle');
const playlistUrlInput = document.getElementById('playlist-url');
const extractBtn = document.getElementById('extract-btn');
const errorEl = document.getElementById('error');
const loadingEl = document.getElementById('loading');
const infoTitle = document.getElementById('info-title');
const infoArtist = document.getElementById('info-artist');
const infoAlbum = document.getElementById('info-album');
const infoDuration = document.getElementById('info-duration');
const infoPlaylist = document.getElementById('info-playlist');
const loadedPlaylistsEl = document.getElementById('loaded-playlists');
const loadingStatusEl = document.getElementById('loading-status');
const fetchErrorEl = document.getElementById('fetch-error');
const retryLoadBtn = document.getElementById('retry-load');
const errorDetailsEl = document.getElementById('error-details');

// 初始化
// 初始化（修改DOMContentLoaded事件中的逻辑）
// 移除原来硬编码的数组，改为动态加载
let AUTO_LOAD_PLAYLIST_IDS = [];

// 初始化（修改DOMContentLoaded事件中的逻辑）
document.addEventListener('DOMContentLoaded', function () {
    AOS.init({ duration: 800, easing: 'ease-in-out', once: true });

    // 深色模式检测
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }

    // 事件监听（保持不变）
    playBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', playPreviousSong);
    nextBtn.addEventListener('click', playNextSong);
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', toggleRepeat);
    volumeBar.addEventListener('input', adjustVolume);
    progressBar.addEventListener('input', seekAudio);
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', handleAudioEnd);
    themeToggle.addEventListener('click', toggleTheme);
    extractBtn.addEventListener('click', extractSongs);
    playlistUrlInput.addEventListener('keyup', (e) => e.key === 'Enter' && extractSongs());
    retryLoadBtn.addEventListener('click', retryLoadPlaylists);

    // 初始化音量
    audioPlayer.volume = volumeBar.value / 100;

    // 先加载JSON配置文件，再加载歌单
    loadPlaylistConfig();
});

/**
 * 从JSON文件加载歌单ID配置
 */
async function loadPlaylistConfig() {
    try {
        // 加载JSON文件（注意路径要正确，这里假设和HTML文件同级）
        const response = await fetch('auto-playlists.json');
        if (!response.ok) {
            throw new Error(`配置文件加载失败: ${response.status}`);
        }

        const config = await response.json();
        // 验证配置格式是否正确
        if (Array.isArray(config.playlistIds)) {
            AUTO_LOAD_PLAYLIST_IDS = config.playlistIds;
            console.log('歌单配置加载成功，共', AUTO_LOAD_PLAYLIST_IDS.length, '个歌单');
            // 配置加载成功后，开始加载歌单
            loadAutoPlaylists();
        } else {
            throw new Error('配置文件格式错误，缺少playlistIds数组');
        }
    } catch (error) {
        console.error('加载歌单配置失败:', error);
        // 失败时使用默认歌单（兜底方案）
        AUTO_LOAD_PLAYLIST_IDS = [
            '8560313164'
           
        ];
        console.log('使用默认歌单配置');
        loadAutoPlaylists();
    }
}

// 其他代码保持不变...

/**
 * 重试加载歌单
 */
function retryLoadPlaylists() {
    // 重置状态
    playlists = {
        all: {
            id: 'all',
            name: '全部歌曲',
            songs: [],
            description: '所有已加载歌单的歌曲集合'
        }
    };
    currentPlaylistId = 'all';
    currentSongIndex = -1;
    autoLoadComplete = false;
    fetchErrorEl.classList.add('hidden');
    allSongsPlaylist.innerHTML = '<li class="p-4 text-center text-gray-500 dark:text-gray-400">正在重新加载推荐歌单...</li>';
    playlistTabs.innerHTML = '<div class="playlist-tab whitespace-nowrap py-2 px-1 cursor-pointer font-medium playlist-tab-active" data-playlist-id="all">全部歌曲</div>';
    
    // 重新加载
    loadAutoPlaylists();
}

/**
 * 自动加载指定的歌单
 */
async function loadAutoPlaylists() {
    let loadedCount = 0;
    let allFailed = true;
    const errorMessages = [];
    
    // 逐个加载歌单，每个歌单最多重试2次
    for (const playlistId of AUTO_LOAD_PLAYLIST_IDS) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                loadingStatusEl.textContent = `${loadedCount}/${AUTO_LOAD_PLAYLIST_IDS.length}`;
                console.log(`正在加载歌单 ${playlistId} (第${attempt}次尝试)`);
                
                // 先获取歌单详情（包括名称）
                const playlistDetail = await fetchPlaylistDetail(playlistId);
                // 再获取歌曲列表
                const playlistData = await fetchPlaylistData(playlistId);
                
                if (playlistData && Array.isArray(playlistData) && playlistData.length > 0) {
                    await addPlaylist(playlistData, playlistId, playlistDetail);
                    loadedCount++;
                    allFailed = false;
                    break; // 加载成功则跳出重试循环
                } else {
                    throw new Error('返回数据为空或格式不正确');
                }
            } catch (err) {
                console.error(`加载歌单 ${playlistId} 失败 (第${attempt}次尝试):`, err);
                if (attempt === 2) { // 最后一次尝试失败才记录错误
                    errorMessages.push(`歌单 ${playlistId}: ${err.message}`);
                }
            }
        }
    }
    
    // 更新最终状态
    loadingStatusEl.textContent = `${loadedCount}/${AUTO_LOAD_PLAYLIST_IDS.length}`;
    autoLoadComplete = true;
    
    // 处理加载结果
    if (allFailed) {
        fetchErrorEl.classList.remove('hidden');
        errorDetailsEl.innerHTML = `错误详情: ${errorMessages.join('; ')}<br>您可以尝试：
            <button id="retry-load" class="text-red-600 dark:text-red-300 underline ml-1">重试</button>
            或手动输入歌单链接`;
        currentSongTitle.textContent = "歌单加载失败";
        currentSongArtist.textContent = "请尝试重试或手动提取";
    } else if (playlists.all.songs.length > 0) {
        currentSongTitle.textContent = "请选择歌曲播放";
        currentSongArtist.textContent = "或点击播放按钮开始";
    } else {
        currentSongTitle.textContent = "没有可用歌曲";
        currentSongArtist.textContent = "请尝试使用附加功能提取";
    }
    
    updateLoadedPlaylistsUI();
}

/**
 * 获取歌单详情（包括名称）
 */
async function fetchPlaylistDetail(playlistId) {
    try {
        const url = `${PLAYLIST_DETAIL_API}${playlistId}`;
        console.log(`请求歌单详情API: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
        
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} (${response.statusText})`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('获取歌单详情失败:', error);
        // 即使获取详情失败也不中断流程，后面会使用默认名称
        return null;
    }
}

/**
 * 获取歌单歌曲数据
 */
async function fetchPlaylistData(playlistId) {
    try {
        const url = `${METING_API}${playlistId}`;
        console.log(`请求歌单歌曲API: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时
        
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} (${response.statusText})`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('返回数据不是有效的歌曲数组');
        }
        
        return data;
    } catch (error) {
        console.error('获取歌单歌曲失败:', error);
        if (error.name === 'AbortError') {
            throw new Error('请求超时（超过15秒）');
        } else if (error.message.includes('Failed to fetch')) {
            throw new Error('网络连接失败');
        } else {
            throw error;
        }
    }
}

// 生成随机的服务器哈希（模拟网易云不同服务器的兼容性）
function getRandomServerHash() {
    // 收集常见的网易云图片服务器哈希前缀，随机选择一个提高兼容性
    const commonHashes = [
        '6y-UleORITEDbvrOLV0Q8A==',
        'DljuiG_XJJHoDYce-QZOmA==',
        'QCdGqIuLzn3jzeho7--RXg==',
        'a1ZodRfW4gUfafH08fLg==',
        'b2JhaWxSZXF1ZXN0QmxhY2s='
    ];
    return commonHashes[Math.floor(Math.random() * commonHashes.length)];
}

async function getRealCoverUrl(thirdPartyUrl) {
    // 最多尝试2次获取真实URL
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            // 使用GET方法更可靠，部分服务器对HEAD支持不佳
            const response = await fetch(thirdPartyUrl, {
                method: 'GET',
                redirect: 'follow',
                timeout: 5000,
                // 只获取响应头，不下载 body
                headers: { 'Range': 'bytes=0-1' }
            });

            const realUrl = response.url;

            // 验证是否已重定向到实际图片URL（非第三方接口）
            if (realUrl.includes('api.injahow.cn/meting/')) {
                throw new Error('未成功重定向到实际图片URL');
            }

            // 调整为高清尺寸（512x512）
            if (realUrl.includes('?param=')) {
                return realUrl.replace(/param=(\d+)y(\d+)/, 'param=512y512');
            } else {
                const separator = realUrl.includes('?') ? '&' : '?';
                return `${realUrl}${separator}param=512y512`;
            }
        } catch (error) {
            console.error(`第${attempt}次获取实际图片URL失败:`, error);
            // 如果是最后一次尝试，使用备用方案
            if (attempt === 2) {
                // 从第三方URL中提取图片ID作为备用方案
                const picIdMatch = thirdPartyUrl.match(/id=(\d+)/);
                const picId = picIdMatch ? picIdMatch[1] : '';

                // 生成网易云图片服务器的直接URL（最可靠的备用方案）
                if (picId) {
                    return `https://p2.music.126.net/${getRandomServerHash()}/${picId}.jpg?param=512y512`;
                }

                // 终极备用：使用默认图片
                return `https://p2.music.126.net/${getRandomServerHash()}/5639395138885805.jpg?param=512y512`;
            }
        }
    }
}

/**
 * 添加新的歌单
 */
async function addPlaylist(songsData, playlistId, playlistDetail) {
    // 从歌单详情中提取名称，如果没有则使用默认名称
    let playlistName = `未知歌单(${playlistId})`;
    let playlistDescription = '';
    
    // 尝试从详情数据中获取名称
    if (playlistDetail && typeof playlistDetail === 'object') {
        if (playlistDetail.name) {
            playlistName = playlistDetail.name;
        } 
        // 不同API可能有不同的数据结构，尝试多种可能的字段
        else if (playlistDetail.title) {
            playlistName = playlistDetail.title;
        }
        
        // 获取歌单描述
        if (playlistDetail.description) {
            playlistDescription = playlistDetail.description;
        }
    }
    
    // 如果从详情获取失败，尝试从歌曲数据中提取
    if (playlistName.includes('未知歌单') && songsData.length > 0) {
        const firstSong = songsData[0] || {};
        if (firstSong.name) {
            playlistName = firstSong.name;
        }
    }
    
    // 创建新歌单
    playlists[playlistId] = {
        id: playlistId,
        name: playlistName,
        description: playlistDescription,
        songs: []
    };
    
    // 转换歌曲数据格式
    // 在添加歌曲时使用新的封面处理逻辑（修改addPlaylist函数中的歌曲转换部分）
    const newSongs = await Promise.all(songsData.map(async (song) => {
        // 其他字段处理保持不变
        const songIdMatch = song.url && song.url.match(/id=(\d+)/);
        const songId = songIdMatch && songIdMatch[1] ? songIdMatch[1] : '';

        let duration = '00:00';
        if (song.dt) {
            duration = formatDuration(song.dt);
        } else if (song.url) {
            duration = '--:--';
        }

        // 关键修改：使用第三方接口URL获取实际图片URL
        let coverUrl = song.pic || 'https://p2.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg';
        // 如果是第三方接口URL，获取实际重定向地址
        if (coverUrl.includes('api.injahow.cn/meting/')) {
            coverUrl = await getRealCoverUrl(coverUrl);
        } else {
            // 非第三方URL直接调整尺寸
            if (coverUrl.includes('?param=')) {
                coverUrl = coverUrl.replace(/param=(\d+)y(\d+)/, 'param=512y512');
            } else {
                const separator = coverUrl.includes('?') ? '&' : '?';
                coverUrl = `${coverUrl}${separator}param=512y512`;
            }
        }

        return {
            id: songId,
            title: song.name || `未知歌曲 ${songId}`,
            artist: song.artist || '未知歌手',
            album: song.album || '未知专辑',
            url: song.url || `${SONG_PLAY_URL}${songId}.mp3`,
            cover: coverUrl,
            duration: duration,
            playlistId: playlistId,
            playlistName: playlistName
        };
    }));
    
    // 添加到当前歌单
    playlists[playlistId].songs = newSongs;
    
    // 同时添加到"全部歌曲"歌单
    playlists.all.songs.push(...newSongs);
    
    // 更新UI
    addPlaylistTab(playlistId, playlistName);
    createPlaylistView(playlistId, newSongs);
    updateAllSongsPlaylist();
    updateCurrentPlaylistDisplay();
}

// 注意：原代码似乎不完整，这里提供了一些可能需要补充的函数框架

/**
 * 格式化时长（毫秒 -> MM:SS）
 */
function formatDuration(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 添加歌单标签
 */
/**
 * 添加歌单标签（修改后，适配新样式）
 */
function addPlaylistTab(playlistId, playlistName) {
    const tab = document.createElement('div');
    // 适配新的标签样式（圆角、padding等）
    tab.className = 'playlist-tab py-2 px-4 cursor-pointer font-medium rounded-full';
    tab.dataset.playlistId = playlistId;
    tab.textContent = playlistName;
    tab.addEventListener('click', () => switchPlaylist(playlistId));
    playlistTabs.appendChild(tab);
}

/**
 * 创建歌单视图
 */
function createPlaylistView(playlistId, songs) {
    const playlistView = document.createElement('ul');
    playlistView.id = `${playlistId}-playlist`;
    playlistView.className = 'space-y-2 playlist-view hidden';
    
    songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.className = 'p-3 rounded-lg hover:bg-white/20 transition-colors cursor-pointer flex justify-between items-center';
        li.innerHTML = `
            <div class="flex items-center">
                <span class="w-6 text-center mr-3 text-gray-500">${index + 1}</span>
                <div>
                    <p class="font-medium">${song.title}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${song.artist}</p>
                </div>
            </div>
            <span class="text-sm text-gray-500">${song.duration}</span>
        `;
        li.addEventListener('click', () => playSong(playlistId, index));
        playlistView.appendChild(li);
    });
    
    playlistsContainer.appendChild(playlistView);
}

/**
 * 更新全部歌曲列表
 */
function updateAllSongsPlaylist() {
    allSongsPlaylist.innerHTML = '';
    
    if (playlists.all.songs.length === 0) {
        allSongsPlaylist.innerHTML = '<li class="p-4 text-center text-gray-500 dark:text-gray-400">没有歌曲</li>';
        return;
    }
    
    playlists.all.songs.forEach((song, index) => {
        const li = document.createElement('li');
        li.className = 'p-3 rounded-lg hover:bg-white/20 transition-colors cursor-pointer flex justify-between items-center';
        li.innerHTML = `
            <div class="flex items-center">
                <span class="w-6 text-center mr-3 text-gray-500">${index + 1}</span>
                <div>
                    <p class="font-medium">${song.title}</p>
                    <p class="text-sm text-gray-600 dark:text-gray-400">${song.artist} · ${song.playlistName}</p>
                </div>
            </div>
            <span class="text-sm text-gray-500">${song.duration}</span>
        `;
        li.addEventListener('click', () => playSong('all', index));
        allSongsPlaylist.appendChild(li);
    });
}

/**
 * 切换歌单
 */
function switchPlaylist(playlistId) {
    currentPlaylistId = playlistId;
    
    // 更新标签样式
    document.querySelectorAll('.playlist-tab').forEach(tab => {
        if (tab.dataset.playlistId === playlistId) {
            tab.classList.add('playlist-tab-active');
        } else {
            tab.classList.remove('playlist-tab-active');
        }
    });
    
    // 更新视图
    document.querySelectorAll('.playlist-view').forEach(view => {
        if (view.id === `${playlistId}-playlist` || (playlistId === 'all' && view.id === 'all-songs-playlist')) {
            view.classList.remove('hidden');
            view.classList.add('active');
        } else {
            view.classList.add('hidden');
            view.classList.remove('active');
        }
    });
    
    updateCurrentPlaylistDisplay();
}

/**
 * 更新当前歌单显示信息
 */
function updateCurrentPlaylistDisplay() {
    const playlist = playlists[currentPlaylistId];
    if (playlist) {
        currentPlaylistDisplayTitle.textContent = playlist.name;
        currentPlaylistDisplayCount.textContent = `(${playlist.songs.length})`;
    }
}

/**
 * 播放指定歌曲
 */
function playSong(playlistId, index) {
    const playlist = playlists[playlistId];
    if (!playlist || !playlist.songs || index < 0 || index >= playlist.songs.length) {
        return;
    }
    
    currentPlaylistId = playlistId;
    currentSongIndex = index;
    const song = playlist.songs[index];
    
    // 更新UI
    currentSongTitle.textContent = song.title;
    currentSongArtist.textContent = song.artist;
    currentPlaylistName.textContent = song.playlistName;
    albumCover.src = song.cover;
    audioPlayer.src = song.url;
    
    // 更新歌曲信息面板
    infoTitle.textContent = song.title;
    infoArtist.textContent = song.artist;
    infoAlbum.textContent = song.album;
    infoPlaylist.textContent = song.playlistName;
    infoDuration.textContent = song.duration;
    
    // 播放
    audioPlayer.play();
    updatePlayPauseUI(true);
    audioWave.style.display = 'flex';
    vinylContainer.classList.add('vinyl-rotate');
}

/**
 * 切换播放/暂停状态
 */
function togglePlayPause() {
    if (audioPlayer.paused) {
        // 如果还没有选择歌曲，尝试播放第一首
        if (currentSongIndex === -1 && playlists[currentPlaylistId].songs.length > 0) {
            playSong(currentPlaylistId, 0);
        } else {
            audioPlayer.play();
            updatePlayPauseUI(true);
            audioWave.style.display = 'flex';
            vinylContainer.classList.add('vinyl-rotate');
        }
    } else {
        audioPlayer.pause();
        updatePlayPauseUI(false);
        audioWave.style.display = 'none';
        vinylContainer.classList.remove('vinyl-rotate');
    }
}

/**
 * 更新播放/暂停按钮UI
 */
function updatePlayPauseUI(isPlaying) {
    const icon = playBtn.querySelector('i');
    if (isPlaying) {
        icon.classList.remove('fa-play');
        icon.classList.add('fa-pause');
    } else {
        icon.classList.remove('fa-pause');
        icon.classList.add('fa-play');
    }
}

/**
 * 播放上一首
 */
function playPreviousSong() {
    const playlist = playlists[currentPlaylistId];
    if (!playlist || playlist.songs.length === 0) return;
    
    let newIndex;
    if (isShuffle) {
        // 随机播放模式下，避免连续播放同一首
        do {
            newIndex = Math.floor(Math.random() * playlist.songs.length);
        } while (newIndex === currentSongIndex && playlist.songs.length > 1);
    } else {
        newIndex = currentSongIndex > 0 ? currentSongIndex - 1 : playlist.songs.length - 1;
    }
    
    playSong(currentPlaylistId, newIndex);
}

/**
 * 播放下一首
 */
function playNextSong() {
    const playlist = playlists[currentPlaylistId];
    if (!playlist || playlist.songs.length === 0) return;
    
    let newIndex;
    if (isShuffle) {
        // 随机播放模式下，避免连续播放同一首
        do {
            newIndex = Math.floor(Math.random() * playlist.songs.length);
        } while (newIndex === currentSongIndex && playlist.songs.length > 1);
    } else {
        newIndex = currentSongIndex < playlist.songs.length - 1 ? currentSongIndex + 1 : 0;
    }
    
    playSong(currentPlaylistId, newIndex);
}

/**
 * 切换随机播放
 */
function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('bg-secondary/30', isShuffle);
    shuffleBtn.classList.toggle('bg-white/20', !isShuffle);
}

/**
 * 切换循环播放
 */
function toggleRepeat() {
    isRepeat = !isRepeat;
    repeatBtn.classList.toggle('bg-secondary/30', isRepeat);
    repeatBtn.classList.toggle('bg-white/20', !isRepeat);
}

/**
 * 调整音量
 */
function adjustVolume() {
    audioPlayer.volume = volumeBar.value / 100;
}

/**
 * 调整播放进度
 */
function seekAudio() {
    const seekTime = (progressBar.value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
}

/**
 * 更新播放进度
 */
function updateProgress() {
    if (isNaN(audioPlayer.duration)) return;
    
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = progress;
    
    currentTimeEl.textContent = formatDuration(audioPlayer.currentTime * 1000);
    totalTimeEl.textContent = formatDuration(audioPlayer.duration * 1000);
}

/**
 * 处理音频播放结束
 */
function handleAudioEnd() {
    if (isRepeat) {
        // 单曲循环
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else {
        // 播放下一首
        playNextSong();
    }
}

/**
 * 切换深色/浅色模式
 */
function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.theme = 'light';
    } else {
        document.documentElement.classList.add('dark');
        localStorage.theme = 'dark';
    }
}

/**
 * 提取歌单
 */
function extractSongs() {
    const url = playlistUrlInput.value.trim();
    if (!url) {
        showError('请输入网易云歌单链接');
        return;
    }
    
    // 从URL中提取歌单ID
    const match = url.match(/playlist\?id=(\d+)/);
    if (!match || !match[1]) {
        showError('请输入有效的网易云歌单链接，例如：https://music.163.com/playlist?id=13447929909');
        return;
    }
    
    const playlistId = match[1];
    
    // 检查是否已加载
    if (playlists[playlistId]) {
        showError('该歌单已加载');
        return;
    }
    
    // 加载歌单
    loadCustomPlaylist(playlistId);
}

/**
 * 加载自定义歌单
 */
async function loadCustomPlaylist(playlistId) {
    try {
        showLoading(true);
        showError('');
        
        // 先获取歌单详情
        const playlistDetail = await fetchPlaylistDetail(playlistId);
        // 再获取歌曲列表
        const playlistData = await fetchPlaylistData(playlistId);
        
        if (playlistData && Array.isArray(playlistData) && playlistData.length > 0) {
            await addPlaylist(playlistData, playlistId, playlistDetail);
            switchPlaylist(playlistId);
            playlistUrlInput.value = '';
        } else {
            showError('未能获取到歌曲数据，请检查歌单是否有效');
        }
    } catch (error) {
        console.error('加载自定义歌单失败:', error);
        showError(`提取失败: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

/**
 * 显示/隐藏加载状态
 */
function showLoading(show) {
    if (show) {
        loadingEl.classList.remove('hidden');
        extractBtn.disabled = true;
    } else {
        loadingEl.classList.add('hidden');
        extractBtn.disabled = false;
    }
}

/**
 * 显示错误信息
 */
function showError(message) {
    if (message) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    } else {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
}

/**
 * 更新已加载歌单UI
 */
function updateLoadedPlaylistsUI() {
    loadedPlaylistsEl.innerHTML = '';
    
    // 排除"全部歌曲"这个特殊歌单
    Object.values(playlists).forEach(playlist => {
        if (playlist.id === 'all') return;
        
        const div = document.createElement('div');
        div.className = 'flex justify-between items-center p-2 hover:bg-white/10 rounded';
        div.innerHTML = `
            <div>
                <p class="font-medium">${playlist.name}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">${playlist.songs.length} 首歌曲</p>
            </div>
            <button class="text-sm text-primary dark:text-secondary" data-playlist-id="${playlist.id}">
                切换到
            </button>
        `;
        
        // 添加切换歌单事件
        div.querySelector('button').addEventListener('click', (e) => {
            switchPlaylist(e.target.dataset.playlistId);
        });
        
        loadedPlaylistsEl.appendChild(div);
    });
    
    if (loadedPlaylistsEl.children.length === 0) {
        loadedPlaylistsEl.innerHTML = '<p>暂无加载的歌单</p>';
    }
}
