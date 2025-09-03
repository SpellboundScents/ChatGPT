import { useEffect, useState } from 'react';
import { Form, Radio, Switch, Input, Button, Space, message, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import * as shell from '@tauri-apps/plugin-shell';
import * as path from '@tauri-apps/api/path';
import { ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { clone, omit, isEqual } from 'lodash';
import { emit } from '@tauri-apps/api/event';

import useInit from '@/hooks/useInit';
import { DISABLE_AUTO_COMPLETE, chatRoot } from '@/utils';

const AutoUpdateLabel = () => (
  <span>
    Auto Update{' '}
    <Tooltip
      title={
        <div>
          <div>Auto Update Policy</div>
          <span><strong>Prompt</strong>: prompt to install</span><br />
          <span><strong>Silent</strong>: install silently</span><br />
        </div>
      }
    >
      <QuestionCircleOutlined style={{ color: '#1677ff' }} />
    </Tooltip>
  </span>
);

const OriginLabel = ({ url }: { url: string }) => (
  <span>
    Switch Origin <Tooltip title={`Default: ${url}`}><QuestionCircleOutlined style={{ color: '#1677ff' }} /></Tooltip>
  </span>
);

const PopupSearchLabel = () => (
  <span>
    Pop-up Search{' '}
    <Tooltip
      title={
        <div>
          <div style={{ marginBottom: 10 }}>
            Generate images according to the content: Select the ChatGPT content with the mouse, no more than 400 characters. the <b>DALL·E 2</b> button appears, and click to jump (Note: because the search content filled by the script cannot trigger the event directly, you need to enter a space in the input box to make the button clickable).
          </div>
          <div>The application is built using Tauri, and due to its security restrictions, some of the action buttons will not work, so we recommend going to your browser.</div>
        </div>
      }
    >
      <QuestionCircleOutlined style={{ color: '#1677ff' }} />
    </Tooltip>
  </span>
);

const GlobalShortcutLabel = () => (
  <div>
    Global Shortcut{' '}
    <Tooltip
      title={
        <div>
          <div>Shortcut definition, modifiers and key separated by "+" e.g. CmdOrControl+Q</div>
          <div style={{ margin: '10px 0' }}>If empty, the shortcut is disabled.</div>
          <a href="https://tauri.app/v1/api/js/globalshortcut" target="_blank">https://tauri.app/v1/api/js/globalshortcut</a>
        </div>
      }
    >
      <QuestionCircleOutlined style={{ color: '#1677ff' }} />
    </Tooltip>
  </div>
);

export default function General() {
  const [form] = Form.useForm();
  const [jsonPath, setJsonPath] = useState('');
  const [chatConf, setChatConf] = useState<any>(null);

  useInit(async () => {
    setJsonPath(await path.join(await chatRoot(), 'chat.conf.json'));
    const conf = await invoke<any>('get_chat_conf');
    // normalize theme to lowercase for the radio group
    conf.theme = String(conf?.theme ?? 'system').toLowerCase();
    setChatConf(conf);
  });

  useEffect(() => {
    if (chatConf) form.setFieldsValue(clone(chatConf));
  }, [chatConf, form]);

  const onCancel = () => {
    form.setFieldsValue(chatConf);
  };

  const onReset = async () => {
    const conf = await invoke<any>('reset_chat_conf');
    conf.theme = String(conf?.theme ?? 'system').toLowerCase();
    setChatConf(conf);
    const isOk = await ask('Configuration reset successfully, whether to restart?', { title: 'ChatGPT Preferences' });
    if (isOk) { relaunch(); return; }
    message.success('Configuration reset successfully');
  };

  const onFinish = async (values: any) => {
    const merged = { ...(chatConf ?? {}), ...values, theme: String(values.theme ?? 'system').toLowerCase() };
    if (!isEqual(omit(chatConf, ['default_origin']), merged)) {
      await invoke('set_chat_conf', { conf: merged });   // <-- save to disk
      try { await emit('menu-set-theme', merged.theme); } catch {}
      const isOk = await ask('Configuration saved successfully, whether to restart?', { title: 'ChatGPT Preferences' });
      if (isOk) { relaunch(); return; }
      message.success('Configuration saved successfully');
      setChatConf(merged);
    }
  };

  return (
    <>
      <div className="chat-table-tip">
        <div className="chat-sync-path">
          <div>PATH: <a onClick={() => shell.open(jsonPath)} title={jsonPath}>{jsonPath}</a></div>
        </div>
      </div>

      <Form
        form={form}
        style={{ maxWidth: 500 }}
        onFinish={onFinish}
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 15, offset: 1 }}
      >
        <Form.Item label="Stay On Top" name="stay_on_top" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label={<PopupSearchLabel />} name="popup_search" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item label="Theme" name="theme">
          <Radio.Group
            onChange={async (e) => {
              const v = String(e.target.value || 'system').toLowerCase();
              form.setFieldValue('theme', v);

              // Flip native theme on ALL windows + broadcast payload
              try { await invoke('set_theme_all', { theme: v }); } catch {}

              // Also update this window’s React state immediately (belt & suspenders)
              try { await emit('menu-set-theme', v); } catch {}

              console.log('[theme] onChange ->', v);
            }}
          >
            <Radio value="light">Light</Radio>
            <Radio value="dark">Dark</Radio>
            <Radio value="system">System</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label={<AutoUpdateLabel />} name="auto_update">
          <Radio.Group>
            <Radio value="prompt">Prompt</Radio>
            <Radio value="silent">Silent</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label={<GlobalShortcutLabel />} name="global_shortcut">
          <Input placeholder="CmdOrCtrl+Shift+O" {...DISABLE_AUTO_COMPLETE} />
        </Form.Item>

        <Form.Item label={<OriginLabel url={chatConf?.default_origin} />} name="origin">
          <Input placeholder="https://chat.openai.com" {...DISABLE_AUTO_COMPLETE} />
        </Form.Item>

        <Form.Item label="User Agent (Window)" name="ua_window">
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 4 }} {...DISABLE_AUTO_COMPLETE} placeholder="Mozilla/5.0 ..." />
        </Form.Item>

        <Form.Item label="User Agent (SystemTray)" name="ua_tray">
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 4 }} {...DISABLE_AUTO_COMPLETE} placeholder="Mozilla/5.0 ..." />
        </Form.Item>

        <Form.Item>
          <Space size={20}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit">Submit</Button>
            <Button type="dashed" onClick={onReset}>Reset to defaults</Button>
          </Space>
        </Form.Item>
      </Form>
    </>
  );
}