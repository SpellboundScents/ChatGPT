import { useMemo, useState, useEffect } from 'react';
import { Layout, Menu, Tooltip, ConfigProvider, theme, Tag, Button } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { getName, getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import useInit from '@/hooks/useInit';
import Routes, { menuItems } from '@/routes';
import './index.scss';

const { Content, Footer, Sider } = Layout;

type AppTheme = 'light' | 'dark' | 'system';

export default function ChatLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [appInfo, setAppInfo] = useState<{ appName?: string; appVersion?: string; appTheme: AppTheme }>({ appTheme: 'system' });

  const location = useLocation();
  const go = useNavigate();

  // initialize app name/version
 // initialize app name/version
useInit(async () => {
  try {
    const info = await invoke<{ name: string; version: string }>('get_app_info');
    setAppInfo(prev => ({ ...prev, appName: info.name, appVersion: info.version, appTheme: prev.appTheme ?? 'system' }));
  } catch {
    // fallback (shouldn't be needed, but safe)
    const [appName, appVersion] = await Promise.all([getName(), getVersion()]);
    setAppInfo(prev => ({ ...prev, appName, appVersion, appTheme: prev.appTheme ?? 'system' }));
  }
});

  // menubar "toggle" event (optional)
  useEffect(() => {
    const unlisten = listen('menu-toggle-dark', () => {
      setAppInfo(prev => ({ ...prev, appTheme: prev.appTheme === 'dark' ? 'light' : 'dark' }));
    });
    return () => { unlisten.then(u => u()); };
  }, []);

  // deterministic theme-set event
  useEffect(() => {
    const unlisten = listen<string>('menu-set-theme', (e) => {
      const v = String(e?.payload || 'system').toLowerCase() as AppTheme;
      if (v === 'light' || v === 'dark' || v === 'system') {
        setAppInfo(prev => ({ ...prev, appTheme: v }));
      }
    });
    return () => { unlisten.then(u => u()); };
  }, []);

  // system dark detection
  const isSystemDark = useMemo(() => {
    return typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, []);

  const isDark = appInfo.appTheme === 'dark' || (appInfo.appTheme === 'system' && isSystemDark);

  // updater button handler
  const checkAppUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    try {
      await invoke('run_check_update', { silent: false, hasMsg: true });
    } catch (e) {
      console.error('update check failed', e);
    } finally {
      setUpdating(false);
    }
  };

  const selectedKeys = [location.pathname || '/config'];
  const onMenuClick = (i: { key: string }) => go(i.key);

  // small global for ad-hoc testing (optional)
  useEffect(() => {
    (window as any).__setTheme = (v: string) => {
      const t = String(v || 'system').toLowerCase();
      if (t === 'light' || t === 'dark' || t === 'system') {
        setAppInfo(prev => ({ ...prev, appTheme: t as AppTheme }));
        console.log('[theme] __setTheme ->', t);
      }
    };
    return () => { try { delete (window as any).__setTheme; } catch {} };
  }, []);

  return (
    <ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }} hasSider>
        <Sider
          theme={isDark ? 'dark' : 'light'}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 999 }}
        >
          <div className="chat-logo"><img src="/logo.png" /></div>
          <div className="chat-info">
            <Tag>{appInfo.appName}</Tag>
            <Tag>
            <span style={{ marginRight: 5 }}>{appInfo.appVersion}</span>
            <Tooltip title={updating ? 'Checking…' : 'Click to check update'}>
              <a onClick={checkAppUpdate} aria-busy={updating} aria-label="Check for updates">
                <SyncOutlined spin={updating} />
              </a>
            </Tooltip>
          </Tag>
          </div>

          <Menu
            selectedKeys={selectedKeys}
            mode="inline"
            theme={isDark ? 'dark' : 'light'}
            inlineIndent={12}
            items={menuItems as any}
            onClick={onMenuClick}
          />
        </Sider>

        <Layout className="chat-layout" style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 300ms ease-out' }}>
          <Content className="chat-container" style={{ overflow: 'inherit' }}>
            <Routes />
          </Content>
          <Footer style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: 8 }}>
              <a href="https://github.com/SpellboundScents/chatgpt" target="_blank" rel="noreferrer">
                ChatGPT Desktop Application
              </a> ©2022 lencx, ©2025 chirv
            </div>
            <Button
              type="primary"
              size="small"
              onClick={() => invoke('open_external', { url: 'https://buymeacoffee.com/chirv' })}
              style={{ borderRadius: 999, padding: '0 12px' }}
            >
              ☕ Buy me a coffee
            </Button>
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}