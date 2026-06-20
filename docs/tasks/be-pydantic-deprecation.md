# Replace deprecated pydantic FieldValidationInfo with ValidationInfo

**Area:** backend · **Effort:** quick · **Depends on:** none

## Objective
Stop importing the deprecated, soon-to-be-removed pydantic.FieldValidationInfo in src/mindflow/models/provider.py. Replace it with pydantic.ValidationInfo, the supported V2 type that has the same .data attribute, so the model is V3-ready and emits no deprecation warning.

## Files to touch
- `src/mindflow/models/provider.py` — Line 16-17: merge the two pydantic import lines and drop FieldValidationInfo, importing ValidationInfo instead. Line 78: change the type annotation of the validator's 'info' parameter from "FieldValidationInfo" to ValidationInfo.

## Steps
1. Read src/mindflow/models/provider.py lines 16-17. They currently are:  from pydantic import BaseModel, Field, field_validator  /  from pydantic import FieldValidationInfo
2. Replace those two lines with a single line:  from pydantic import BaseModel, Field, ValidationInfo, field_validator   (alphabetical order keeps ruff's isort 'I' rule happy).
3. Go to line 78, the validate_endpoint_url validator signature:  def validate_endpoint_url(cls, v: Optional[str], info: "FieldValidationInfo") -> Optional[str]:  — change the annotation "FieldValidationInfo" (a forward-ref string) to ValidationInfo (now a real imported name, no quotes needed).
4. Leave the validator BODY unchanged: it uses info.data.get("auth_method") and info.data.get("type"); ValidationInfo exposes the identical .data dict, so behaviour is preserved.
5. Confirm no other file in src/ or tests/ imports FieldValidationInfo (a repo grep shows provider.py is the only user).

## Acceptance criteria
- [ ] src/mindflow/models/provider.py no longer contains the token 'FieldValidationInfo' anywhere.
- [ ] The validator signature uses 'info: ValidationInfo' (unquoted) and ValidationInfo is imported from pydantic.
- [ ] Importing the module raises NO PydanticDeprecatedSince20 warning.
- [ ] The endpoint_url validator still raises ValueError for a LOCAL/endpoint provider with no endpoint_url (unchanged behaviour).

## Verify
```
venv\Scripts\python.exe -W error::DeprecationWarning -c "import mindflow.models.provider"   (must exit 0 — previously importing FieldValidationInfo would raise PydanticDeprecatedSince20 under -W error)
venv\Scripts\python.exe -m pytest tests/unit/test_provider_model.py -o "addopts=" -p no:cacheprovider -q   (the provider model's validator tests must still pass)
From Git Bash:  grep -rn FieldValidationInfo src/ tests/   (must print nothing)
```

## Gotchas
- Verified against the installed pydantic 2.13.4: 'from pydantic import FieldValidationInfo' raises PydanticDeprecatedSince20 ('Deprecated in Pydantic V2.0 to be removed in V3.0'), while 'from pydantic import ValidationInfo' imports cleanly. ValidationInfo is the drop-in replacement and exposes the same .data attribute the validator relies on.
- After the edit, the annotation no longer needs to be a forward-ref string ('FieldValidationInfo' was quoted because... actually it didn't need to be quoted before either, but ValidationInfo is now a concrete imported symbol so use it bare: info: ValidationInfo).
- If test_provider_model.py is consolidated by the be-consolidate-test-trees card, its path may change to tests/unit/test_provider_model.py (it is already there today). Run the whole suite if unsure.
- Atomic commit: 'fix(015): replace deprecated pydantic FieldValidationInfo with ValidationInfo'.
