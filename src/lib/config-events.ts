// 配置变更事件总线
// 服务端：通过 configEventBus 在进程内通知
// 前端：通过 window CustomEvent 跨组件通信

type ConfigChangeListener = (key: string, newValue: string, oldValue?: string) => void;

class ConfigEventBus {
  private listeners = new Map<string, Set<ConfigChangeListener>>();
  private wildcardListeners = new Set<ConfigChangeListener>();

  /** 订阅特定配置项的变更 */
  on(key: string, listener: ConfigChangeListener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);
    return () => { this.listeners.get(key)?.delete(listener); };
  }

  /** 订阅所有配置项的变更 */
  onAny(listener: ConfigChangeListener): () => void {
    this.wildcardListeners.add(listener);
    return () => { this.wildcardListeners.delete(listener); };
  }

  /** 触发配置变更事件 */
  emit(key: string, newValue: string, oldValue?: string): void {
    this.listeners.get(key)?.forEach(l => l(key, newValue, oldValue));
    this.wildcardListeners.forEach(l => l(key, newValue, oldValue));
  }

  /** 清理所有监听器（组件卸载时使用） */
  clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }
}

export const configEventBus = new ConfigEventBus();
