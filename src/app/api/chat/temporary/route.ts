import { redirect } from "next/navigation";
import { auth } from "../../auth/auth";
import { Message, smoothStream, streamText } from "ai";
import { customModelProvider } from "lib/ai/models";
import logger from "logger";
import { mergeSystemPrompt } from "../helper";
import { SYSTEM_TIME_PROMPT } from "lib/ai/prompts";

export async function POST(request: Request) {
  try {
    const json = await request.json();

    const session = await auth();

    if (!session?.user.id) {
      return redirect("/login");
    }

    const { messages, model: modelName, systemPrompt: defaultSystemPrompt = "You are a friendly assistant! Keep your responses concise and helpful." + SYSTEM_TIME_PROMPT(session) } = json as {
      messages: Message[];
      model: string;
      systemPrompt?: string;
    };

    const model = customModelProvider.getModel(modelName);

    const systemPrompt = mergeSystemPrompt(
      defaultSystemPrompt,
      SYSTEM_TIME_PROMPT(session),
    );

    return streamText({
      model,
      system: systemPrompt,
      messages,
      maxSteps: 10,
      experimental_continueSteps: true,
      experimental_transform: smoothStream({ chunking: "word" }),
    }).toDataStreamResponse();
  } catch (error: any) {
    logger.error(error);
    return new Response(error.message || "Oops, an error occured!", {
      status: 500,
    });
  }
}
