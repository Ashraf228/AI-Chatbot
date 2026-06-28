import { Injectable } from '@nestjs/common';
import { AgentSelectorService } from './agent-selector.service';
import { ConversationContextService } from './conversation-context.service';
import { ConversationQualityService } from './conversation-quality.service';
import {
  ConversationDecision,
  ConversationEnginePreviewInput,
} from './conversation-engine.types';
import { GoalDetectorService } from './goal-detector.service';
import { HandoffReadinessService } from './handoff-readiness.service';
import { IntentClassifierService } from './intent-classifier.service';
import { NextActionService } from './next-action.service';

@Injectable()
export class ConversationEngineService {
  constructor(
    private readonly contextBuilder: ConversationContextService,
    private readonly intentClassifier: IntentClassifierService,
    private readonly goalDetector: GoalDetectorService,
    private readonly agentSelector: AgentSelectorService,
    private readonly nextAction: NextActionService,
    private readonly handoffReadiness: HandoffReadinessService,
    private readonly quality: ConversationQualityService,
  ) {}

  preview(input: ConversationEnginePreviewInput): ConversationDecision {
    const context = this.contextBuilder.build(input);
    const intent = this.intentClassifier.classify(context);
    const goal = this.goalDetector.detect(context, intent.intent);
    const agent = this.agentSelector.select(context, intent.intent, goal.goal);
    const handoff = this.handoffReadiness.evaluate(context, goal.goal);
    const action = this.nextAction.decide(context, intent.intent, goal.goal);
    const shouldUseKnowledge = goal.goal === 'answer_from_knowledge' ||
      context.assistantProfile.knowledgeMode === 'strict' ||
      context.assistantProfile.enabledTasks.includes('answer_questions');

    const decision: ConversationDecision = {
      intent: intent.intent,
      goal: goal.goal,
      stage: goal.stage,
      confidence: Math.min(0.99, Math.max(0.1, intent.confidence)),
      selectedAgentKey: agent.selectedAgentKey,
      suggestedAgentKey: agent.suggestedAgentKey,
      agentSelectionReason: agent.reason,
      agentAvailable: agent.agentAvailable,
      requiredFields: context.requiredFields,
      missingFields: context.missingFields,
      knownFields: context.knownFields,
      nextAction: action.nextAction,
      shouldUseKnowledge,
      shouldHandoff: handoff.shouldHandoff,
      shouldAskQuestion: action.shouldAskQuestion,
      shouldSummarize: handoff.shouldSummarize,
      warnings: context.warnings,
      reasons: [
        ...context.reasons,
        ...intent.reasons,
        ...goal.reasons,
        agent.reason,
        handoff.reason,
        action.reason,
      ],
    };

    return this.quality.finalize(context, decision);
  }
}
