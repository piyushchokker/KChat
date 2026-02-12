import { NextResponse } from "next/server";
import { createServerClient, createAdminClient } from "@/lib/supabase-server";

/**
 * POST /api/chat
 *
 * Send a chat message and get an AI response.
 * Persists both user and assistant messages to Supabase.
 *
 * Body: { query: string, conversationId?: string }
 */
export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get internal user
  const { data: user } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", authUser.id)
    .single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { query, conversationId } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Query is required" },
      { status: 400 }
    );
  }

  let activeConversationId = conversationId;

  // Create new conversation if none provided
  if (!activeConversationId) {
    const title =
      query.length > 50 ? query.substring(0, 50) + "..." : query;

    const { data: conv, error: convError } = await admin
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Failed to create conversation" },
        { status: 500 }
      );
    }

    activeConversationId = conv.id;
  } else {
    // Verify conversation belongs to user
    const { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }
  }

  // Save user message
  const { data: userMsg, error: userMsgError } = await admin
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      role: "user",
      content: query.trim(),
    })
    .select()
    .single();

  if (userMsgError) {
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }

  // ================================================
  // AI RESPONSE — Replace with your RAG pipeline
  // ================================================
  // For now, using keyword-based mock responses.
  // In production, this would call your Python RAG backend
  // or an LLM API with document context.
  const aiResponse = generateMockResponse(query);

  // Save assistant message
  const { data: assistantMsg, error: assistantMsgError } = await admin
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      role: "assistant",
      content: aiResponse.answer,
      sources: aiResponse.sources,
      confidence: aiResponse.confidence,
    })
    .select()
    .single();

  if (assistantMsgError) {
    return NextResponse.json(
      { error: "Failed to save response" },
      { status: 500 }
    );
  }

  // Update conversation title and updated_at
  await admin
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", activeConversationId);

  return NextResponse.json({
    conversationId: activeConversationId,
    userMessage: {
      id: userMsg.id,
      role: userMsg.role,
      content: userMsg.content,
      timestamp: userMsg.created_at,
    },
    assistantMessage: {
      id: assistantMsg.id,
      role: assistantMsg.role,
      content: assistantMsg.content,
      timestamp: assistantMsg.created_at,
      sources: assistantMsg.sources,
      confidence: assistantMsg.confidence,
    },
  });
}

// ----- Mock AI response generator (replace with real RAG) -----

const MOCK_RESPONSES: Record<string, string> = {
  admission:
    "For admission to K.R. Mangalam University, you need to:\n\n1. Visit our official website and fill out the application form\n2. Submit required documents (10th & 12th marksheets, ID proof)\n3. Appear for the entrance test/interview\n4. Pay the registration fee\n\nDeadline for applications is March 31, 2026.",
  scholarship:
    "K.R. Mangalam University offers several scholarships:\n\n• **Merit Scholarship**: Up to 100% tuition waiver for top performers\n• **Sports Scholarship**: For national/state level athletes\n• **Need-Based Aid**: Financial assistance based on family income\n\nApply through the Student Portal → Scholarships section.",
  exam:
    "The exam schedule for the current semester:\n\n• **Mid-Term Exams**: March 15-25, 2026\n• **End-Term Exams**: May 10-30, 2026\n• **Supplementary Exams**: July 5-15, 2026\n\nDetailed date sheets are available on the university notice board and student portal.",
  registrar:
    "You can contact the Registrar Office through:\n\n• **Email**: registrar@krmangalam.edu.in\n• **Phone**: +91-129-4192000\n• **Office Hours**: Mon-Fri, 9:00 AM - 5:00 PM\n• **Location**: Admin Block, Ground Floor, KRM University Campus",
  transcript:
    "To apply for a transcript:\n\n1. Log in to the Student Portal\n2. Navigate to 'Certificates' → 'Apply for Transcript'\n3. Select transcript type (Official/Unofficial)\n4. Pay the fee (₹500 per copy)\n5. Processing time: 7-10 working days\n\nYou'll receive an email notification when ready for collection.",
  fee: "Fee payment details:\n\n• **Online Payment**: Through the Student Portal → Fee Payment\n• **Bank Transfer**: HDFC Bank, A/C: KRMU Fee Account\n• **Due Date**: 15th of every month\n• **Late Fee**: ₹100 per day after due date\n\nFor fee-related queries, contact accounts@krmangalam.edu.in",
  hostel:
    "Hostel information:\n\n• **Boys Hostel**: Block A & B, capacity 500 students\n• **Girls Hostel**: Block C & D, capacity 400 students\n• **Fee**: ₹75,000 - ₹1,25,000 per year (depending on room type)\n• **Facilities**: Wi-Fi, mess, laundry, gym, common room\n\nApply through Admissions → Hostel Allotment.",
};

function generateMockResponse(query: string) {
  const lower = query.toLowerCase();
  for (const [key, response] of Object.entries(MOCK_RESPONSES)) {
    if (lower.includes(key)) {
      return {
        answer: response,
        confidence: 0.92,
        sources: [
          {
            title: "University Academic Handbook 2025-26",
            type: "guideline",
            relevance: 0.92,
          },
        ],
      };
    }
  }

  return {
    answer:
      "Thank you for your question. I'm searching through the university documents to find the most accurate answer for you. Please note that I can only provide information from officially approved registrar documents.\n\nIf your query requires specific policy interpretation, I'd recommend visiting the Registrar Office during working hours (Mon-Fri, 9 AM - 5 PM) or emailing registrar@krmangalam.edu.in.",
    confidence: 0.5,
    sources: [],
  };
}
