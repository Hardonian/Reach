# Graph Execution Specification

## 1. Graph Structure
The `ExecutionGraph` replaces the linear list of steps.

### Nodes
- **Action**: Executes a tool (e.g. LLM call, API request).
- **Condition**: Evaluates a boolean expression to branch.
- **Parallel**: Executes multiple branches concurrently.
- **SubGraph**: Encapsulates another graph (modular execution).

### Edges
- **Default**: Standard flow.
- **Conditional**: Taken if `Condition` evaluates to true.
- **Fallback**: Taken if the source node fails.

## 2. Strategies
Each node can declare a `Strategy` to control its behavior:

### Retry Policy
- **MaxAttempts**: Limit on retries.
- **StrategyType**:
  - `retry_same_model`: Simple retry.
  - `retry_alternative_model`: Try a different model (routing re-evaluates).
  - `retry_prompt_adjustment`: Modify prompt (if supported).
  - `fallback_node`: Proceed to fallback edge immediately.

### Model Options
- **Capabilities**: Specific requirements (e.g. `ReqReasoningDepth: high`).
- **OptimizationMode**: Node-level override for optimization handling.

## 3. Execution Flow
1. **Start**: Begin at `StartNodeID`.
2. **Execute**: Run the node's tool/logic.
3. **Handle Result**:
   - **Success**: traverse `Default` or `Conditional` edges.
   - **Failure**: Check `RetryPolicy`. If exhausted, traverse `Fallback` edge.
4. **End**: If no edges, execution terminates.

## 4. Deterministic Replay
In replay mode:
- The graph structure is immutable.
- Node IDs map to historical results.
- "Adaptive" decisions (e.g. model routing) made during the original run are respected/replayed, or re-calculated deterministically if the inputs match.
