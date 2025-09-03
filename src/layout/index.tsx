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
  const [appInfo, setAppInfo] = useState<{ appName?: string; appVersion?: string; appTheme: AppTheme }>({ appTheme: 'system' });
  const location = useLocation();
  const go = useNavigate();

  // initialize app name/version + default theme
  useInit(async () => {
    const [appName, appVersion] = await Promise.all([getName(), getVersion()]);
    setAppInfo(prev => ({ ...prev, appName, appVersion, appTheme: prev.appTheme ?? 'system' }));
  });

  // listen for the native menu "toggle" (optional)
  useEffect(() => {
    const unlisten = listen('menu-toggle-dark', () => {
      setAppInfo(prev => ({ 
        ...prev, 
        appTheme: prev.appTheme === 'dark' ? 'light' : 'dark' 
      }));
    });
    return () => { unlisten.then(u => u()); };
  }, []);

  // listen for explicit theme set from Config page (deterministic)
  useEffect(() => {
    const unlisten = listen<string>('menu-set-theme', (e) => {
      const v = String(e?.payload || 'system').toLowerCase() as AppTheme;
      if (v === 'light' || v === 'dark' || v === 'system') {
        setAppInfo(prev => ({ ...prev, appTheme: v }));
      }
    });
    return () => { unlisten.then(u => u()); };
  }, []);

  // system dark detection (single definition)
  const isSystemDark = useMemo(() => {
    return typeof window !== 'undefined'
      && !!window.matchMedia
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, []);

  const isDark = appInfo.appTheme === 'dark' || (appInfo.appTheme === 'system' && isSystemDark);

  const selectedKeys = [location.pathname || '/config'];
  const onMenuClick = (i: { key: string }) => go(i.key);

  // ✅ Listen for theme set from Config window (payload-based)
  useEffect(() => {
    const unlisten = listen<string>('menu-set-theme', (e) => {
      console.log("Received set-theme", e.payload); // debug
      const v = String(e?.payload || 'system').toLowerCase();
      if (v === 'light' || v === 'dark' || v === 'system') {
        setAppInfo(prev => ({ ...prev, appTheme: v as 'light'|'dark'|'system' }));
      }
    });
    return () => { unlisten.then(u => u()); };
  }, []);
  
  // expose a global for quick, deterministic theming from any window
useEffect(() => {
  (window as any).__setTheme = (v: string) => {
    const t = String(v || 'system').toLowerCase();
    if (t === 'light' || t === 'dark' || t === 'system') {
      setAppInfo(prev => ({ ...prev, appTheme: t as any }));
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
              <Tooltip title="click to check update">
                <a onClick={() => {/* wire updater later */}}><SyncOutlined /></a>
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