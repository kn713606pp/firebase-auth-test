// test-auth.js
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import { 
  doc, 
  getDoc, 
  setDoc,
  collection,
  addDoc,
  getDocs,
  enableNetwork,
  disableNetwork
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { auth, db } from './firebase-config.js';

// DOM 元素
const statusDiv = document.getElementById('status');
const userInfoDiv = document.getElementById('user-info');
const userDetailsDiv = document.getElementById('user-details');
const debugOutput = document.getElementById('debug-output');

// 狀態顯示函數
function showStatus(message, type = 'info') {
    statusDiv.className = `status ${type}`;
    statusDiv.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> ${message}`;
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// 顯示用戶資訊
function displayUserInfo(user) {
    if (user) {
        userDetailsDiv.innerHTML = `
            <p><strong>🆔 UID:</strong> ${user.uid}</p>
            <p><strong>📧 Email:</strong> ${user.email || '未提供'}</p>
            <p><strong>👤 顯示名稱:</strong> ${user.displayName || '未設定'}</p>
            <p><strong>✅ Email 驗證:</strong> ${user.emailVerified ? '已驗證' : '未驗證'}</p>
            <p><strong>🕐 最後登入:</strong> ${user.metadata.lastSignInTime}</p>
            <p><strong>📅 帳號創建:</strong> ${user.metadata.creationTime}</p>
            <p><strong>🔗 Provider:</strong> ${user.providerData.map(p => p.providerId).join(', ')}</p>
        `;
        userInfoDiv.style.display = 'block';
    } else {
        userInfoDiv.style.display = 'none';
    }
}

// 監聽驗證狀態變化
onAuthStateChanged(auth, async (user) => {
    if (user) {
        showStatus(`✅ 用戶已登入: ${user.email || user.uid}`, 'success');
        displayUserInfo(user);
        await checkAndCreateUserProfile(user);
    } else {
        showStatus('❌ 用戶未登入', 'error');
        displayUserInfo(null);
    }
});

// 檢查並創建用戶 profile
async function checkAndCreateUserProfile(user) {
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: new Date(),
                lastUpdated: new Date()
            });
            showStatus('✅ 用戶 profile 已創建', 'success');
        } else {
            showStatus('ℹ️ 用戶 profile 已存在', 'info');
        }
    } catch (error) {
        showStatus(`❌ Firestore 錯誤: ${error.message}`, 'error');
    }
}

// 事件監聽器
document.getElementById('google-login').addEventListener('click', async () => {
    showStatus('🔄 正在進行 Google 登入...', 'info');
    
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        showStatus(`✅ Google 登入成功: ${result.user.email}`, 'success');
    } catch (error) {
        showStatus(`❌ Google 登入失敗: ${error.code} - ${error.message}`, 'error');
        
        if (error.code === 'auth/unauthorized-domain') {
            showStatus('🚨 域名未授權！請檢查 Firebase Console 授權域名設定', 'error');
        }
    }
});

document.getElementById('email-login').addEventListener('click', async () => {
    const email = prompt('輸入 Email:');
    const password = prompt('輸入密碼 (至少6個字元):');
    
    if (!email || !password) {
        showStatus('⚠️ 請輸入 Email 和密碼', 'warning');
        return;
    }
    
    showStatus('🔄 正在進行 Email 驗證...', 'info');
    
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        showStatus(`✅ Email 登入成功: ${result.user.email}`, 'success');
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            const createAccount = confirm('用戶不存在，是否創建新帳號？');
            if (createAccount) {
                try {
                    const result = await createUserWithEmailAndPassword(auth, email, password);
                    showStatus(`✅ 帳號創建並登入成功: ${result.user.email}`, 'success');
                } catch (createError) {
                    showStatus(`❌ 創建帳號失敗: ${createError.code} - ${createError.message}`, 'error');
                }
            }
        } else {
            showStatus(`❌ Email 登入失敗: ${error.code} - ${error.message}`, 'error');
        }
    }
});

document.getElementById('logout').addEventListener('click', async () => {
    try {
        await signOut(auth);
        showStatus('✅ 登出成功', 'success');
    } catch (error) {
        showStatus(`❌ 登出失敗: ${error.message}`, 'error');
    }
});

document.getElementById('check-auth').addEventListener('click', () => {
    const user = auth.currentUser;
    if (user) {
        showStatus(`ℹ️ 當前用戶: ${user.email || user.uid}`, 'info');
        displayUserInfo(user);
    } else {
        showStatus('ℹ️ 沒有用戶登入', 'info');
    }
});

// Firestore 測試
document.getElementById('test-firestore').addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
        showStatus('❌ 請先登入再測試 Firestore', 'error');
        return;
    }

    try {
        showStatus('🔄 測試 Firestore 讀寫...', 'info');
        
        const docRef = await addDoc(collection(db, 'test'), {
            userId: user.uid,
            message: 'Hello Firestore!',
            timestamp: new Date()
        });
        
        showStatus(`✅ Firestore 寫入成功, 文檔 ID: ${docRef.id}`, 'success');
        
        const querySnapshot = await getDocs(collection(db, 'test'));
        showStatus(`✅ Firestore 讀取成功, 共 ${querySnapshot.size} 筆資料`, 'success');
        
    } catch (error) {
        showStatus(`❌ Firestore 測試失敗: ${error.message}`, 'error');
    }
});

// 網路控制測試
document.getElementById('test-network').addEventListener('click', async () => {
    try {
        showStatus('🔄 測試離線模式...', 'info');
        await disableNetwork(db);
        showStatus('✅ 網路已禁用，進入離線模式', 'warning');
        
        setTimeout(async () => {
            await enableNetwork(db);
            showStatus('✅ 網路已啟用，回到線上模式', 'success');
        }, 3000);
        
    } catch (error) {
        showStatus(`❌ 網路控制測試失敗: ${error.message}`, 'error');
    }
});

// 除錯資訊
document.getElementById('debug-info').addEventListener('click', () => {
    const debugInfo = {
        'Firebase App 名稱': auth.app.name,
        'Auth 域名': auth.config?.authDomain || 'N/A',
        '當前用戶': auth.currentUser ? auth.currentUser.email : '未登入',
        '當前 URL': window.location.href,
        'User Agent': navigator.userAgent,
        '時間戳': new Date().toISOString()
    };
    
    debugOutput.innerHTML = Object.entries(debugInfo)
        .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
        .join('<br>');
    debugOutput.style.display = 'block';
    
    showStatus('🐛 除錯資訊已顯示', 'info');
});

// 初始化
showStatus('🚀 Firebase Auth 測試中心已載入完成', 'success');
