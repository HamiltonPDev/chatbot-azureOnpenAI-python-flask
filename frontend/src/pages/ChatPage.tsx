/**
 * ChatPage — the template filled with real, live content.
 *
 * @level Page
 *
 * Composition only. Every piece of state and orchestration lives in
 * useChat, so this file reads as a description of the interface.
 */
import { Composer } from "@/components/molecules";
import { ChatHeader, MessageList, TracePanel } from "@/components/organisms";
import { ChatLayout } from "@/components/templates";
import { useChat } from "@/hooks/useChat";
import { useTheme } from "@/hooks/useTheme";

export function ChatPage() {
  const chat = useChat();
  const { resolved, toggle } = useTheme();

  return (
    <ChatLayout
      header={
        <ChatHeader
          runs={chat.runs}
          model={chat.lastModel}
          deployment={chat.lastDeployment}
          canClear={chat.messages.length > 0}
          onClear={chat.clear}
          theme={resolved}
          onToggleTheme={toggle}
        />
      }
      conversation={
        <MessageList messages={chat.messages} isThinking={chat.isThinking} />
      }
      composer={
        <Composer
          value={chat.input}
          notice={chat.notice}
          isThinking={chat.isThinking}
          inputRef={chat.inputRef}
          onChange={chat.changeInput}
          onSend={chat.send}
        />
      }
      aside={<TracePanel trace={chat.trace} latencyMs={chat.lastLatencyMs} />}
    />
  );
}
