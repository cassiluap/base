/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { Settings, RefreshCw, Gamepad2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [url, setUrl] = useState(() => localStorage.getItem('game_shell_url') || '');
  const [isEditing, setIsEditing] = useState(!url);
  const [inputUrl, setInputUrl] = useState(url);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // If the URL changes, we save it instantly
    if (url) {
      localStorage.setItem('game_shell_url', url);
    }
  }, [url]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    let finalUrl = inputUrl.trim();
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    setUrl(finalUrl);
    setIsEditing(false);
  };

  const forceReload = () => {
    setReloadKey((k) => k + 1);
  };

  if (isEditing) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-100 font-sans selection:bg-neutral-800">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-neutral-800 rounded-lg text-neutral-200">
              <Gamepad2 size={28} />
            </div>
            <div>
              <h1 className="text-xl font-medium tracking-tight text-white">Game Shell Setup</h1>
              <p className="text-sm text-neutral-400 mt-0.5">Enter your GitHub Pages URL</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-neutral-400 mb-2">
                Web Game URL
              </label>
              <input
                id="url"
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://yourusername.github.io/yourgame/"
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-100 text-sm rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-neutral-700 transition-all placeholder:text-neutral-600"
                required
              />
            </div>
            
            <div className="pt-2 flex gap-3">
              {url && (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="flex-[2] py-3 px-4 bg-neutral-100 hover:bg-white text-neutral-950 text-sm font-medium rounded-lg transition-colors"
              >
                Launch Game
              </button>
            </div>
          </form>
          
          <div className="mt-8 text-xs text-neutral-500 bg-neutral-950 p-4 rounded-lg border border-neutral-800/50">
            <p><strong>Pro-tip:</strong> You can add this page to your home screen ("Add to Home Screen" on iOS/Android). It will launch like a native fullscreen app and track changes to your GitHub Pages URL automatically.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative group">
      {/* 
        We use an iframe taking the full screen. 
        Changing the key forces the iframe to physically remount, reloading the target URL. 
      */}
      <iframe
        key={reloadKey}
        src={url}
        className="w-full h-full border-0 absolute inset-0"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-popups"
        title="Game View"
      />

      {/* Floating control buttons that appear on hover/tap */}
      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300 z-50">
        <button
          onClick={forceReload}
          className="p-3 bg-black/60 hover:bg-black text-white rounded-full backdrop-blur-md shadow-lg border border-white/10 transition-all"
          title="Reload page"
        >
          <RefreshCw size={20} />
        </button>
        <button
          onClick={() => setIsEditing(true)}
          className="p-3 bg-black/60 hover:bg-black text-white rounded-full backdrop-blur-md shadow-lg border border-white/10 transition-all"
          title="Settings"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
