# Vision Model Evaluation Framework

Test different vision models and prompts for home inventory photo analysis.

## Quick Start

```bash
# Set your API key
export ANTHROPIC_API_KEY=your-key-here

# Preview what will run (no API calls)
npx tsx tests/evaluation/run-evaluation.ts --dry-run

# Run all evaluations (64 combinations: 4 photos x 4 models x 4 prompts)
npx tsx tests/evaluation/run-evaluation.ts

# Run specific subset
npx tsx tests/evaluation/run-evaluation.ts --models=claude-sonnet --prompts=current
npx tsx tests/evaluation/run-evaluation.ts --photos=photo-001,photo-002
```

## Files

- `test-session.json` - Test fixture with photos, expected outputs, prompts, and models
- `run-evaluation.ts` - Evaluation script
- `evaluation-results-*.json` - Output files with scores

## Test Photos

The fixture uses 4 real photos from `evidence/sessions/vin-session/`:

| Photo | Description | Expected Room | Key Items |
|-------|-------------|---------------|-----------|
| photo-001 | Living room with couch, artwork | living room | couch, hat, painting |
| photo-002 | Bedroom with unmade bed | bedroom | bed, bedside table |
| photo-003 | Bedroom detail - table with humidifier | bedroom | lamp, humidifier |
| photo-004 | Storage area with hat on rack | storage | hat, rack |

## Prompts Being Tested

1. **current** - Production prompt from `defaultContexts.ts`
2. **minimal** - Bare minimum instructions
3. **structured** - JSON schema with examples
4. **finding-focused** - Emphasizes "finding things later" use case

## Models Being Tested

| Model | Provider | Notes |
|-------|----------|-------|
| claude-sonnet | Anthropic | Baseline |
| claude-haiku | Anthropic | Faster/cheaper |
| gpt-4o | OpenAI | Not yet implemented |
| gpt-4o-mini | OpenAI | Not yet implemented |

## Evaluation Criteria

- **Format Compliance (15%)** - Does output have room/area/container/items?
- **Room Accuracy (25%)** - Correct room identification
- **Item Recall (35%)** - Found all must-identify items
- **Item Precision (10%)** - No hallucinated items
- **Practical Utility (15%)** - Would help someone find things?

## Adding New Test Photos

1. Add the photo to `evidence/sessions/` or another location
2. Update `test-session.json`:
   ```json
   {
     "id": "photo-005",
     "source_file": "../../path/to/photo.jpg",
     "description": "Brief description",
     "transcript_context": "What the user said while taking photo"
   }
   ```
3. Add expected output:
   ```json
   "photo-005": {
     "room": "kitchen",
     "area": "counter",
     "container": null,
     "items": [{"name": "toaster"}],
     "must_identify": ["toaster"],
     "should_identify": []
   }
   ```

## Interpreting Results

Look at `evaluation-results-*.json` for:

- **Per-combination scores**: How each model+prompt performed on each photo
- **Summary by model**: Which model is best overall
- **Summary by prompt**: Which prompt style works best
- **Best combination**: Top-performing model+prompt pair

Example output:
```
By Model:
  claude-sonnet: 85.2% avg score, 2340ms avg latency
  claude-haiku: 78.1% avg score, 890ms avg latency

By Prompt:
  current: 82.5% avg score
  finding-focused: 84.1% avg score
```

## Extending to OpenAI

The script structure supports OpenAI but implementation is stubbed. To add:

1. Install OpenAI SDK: `npm install openai`
2. Add `analyzeWithOpenAI()` function similar to `analyzeWithAnthropic()`
3. Update the model loop to call appropriate provider function
