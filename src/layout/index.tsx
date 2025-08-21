import { useMemo, useState, useEffect } from 'react';
import { Layout, Menu, Tooltip, ConfigProvider, theme, Tag, Button } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { getName, getVersion } from '@tauri-apps/api/app';
// import { open } from '@tauri-apps/plugin-opener';

// import { runCheckUpdate } from '@tauri-apps/plugin-updater'; // <- removed for now
import { invoke } from '@tauri-apps/api/core';

import useInit from '@/hooks/useInit';
import Routes, { menuItems } from '@/routes';
import './index.scss';

const { Content, Footer, Sider } = Layout;

export default function ChatLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [appInfo, setAppInfo] = useState<{ appName?: string; appVersion?: string; appTheme?: string }>({});
  const location = useLocation();
  const go = useNavigate();

  // Step 5 handled here (no backend theme): system fallback
  useInit(async () => {
    const [appName, appVersion] = await Promise.all([getName(), getVersion()]);
    setAppInfo({ appName, appVersion, appTheme: 'system' });
  });

  const checkAppUpdate = async () => {
    // If you have a Rust command, call it; otherwise wire @tauri-apps/plugin-updater later
    // await invoke('run_check_update', { silent: false, hasMsg: true });
  };

  // System dark detection (no backend)
  const isSystemDark = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, []);
  const isDark = appInfo.appTheme === 'dark' || (appInfo.appTheme === 'system' && isSystemDark);

  // Keep selection in sync even on initial render
  const selectedKeys = [location.pathname || '/config'];

  // Ensure clicking a menu item navigates to its key (which is the path)
  const onMenuClick = (i: { key: string }) => go(i.key);

  return (
    <ConfigProvider theme={{ algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
      <Layout style={{ minHeight: '100vh' }} hasSider>
        <Sider
          theme={isDark ? 'dark' : 'light'}
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0, top: 0, bottom: 0,
            zIndex: 999,
          }}
        >
          <div className="chat-logo"><img src="/logo.png" /></div>
          <div className="chat-info">
            <Tag>{appInfo.appName}</Tag>
            <Tag>
              <span style={{ marginRight: 5 }}>{appInfo.appVersion}</span>
              <Tooltip title="click to check update">
                <a onClick={checkAppUpdate}><SyncOutlined /></a>
              </Tooltip>
            </Tag>
          </div>

          <Menu
  selectedKeys={[location.pathname || '/config']}
  mode="inline"
  theme={isDark ? 'dark' : 'light'}
  inlineIndent={12}
  items={menuItems as any}
  onClick={(i) => go(i.key)}
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
