import logging
from fastapi import APIRouter, HTTPException, status

from app.core.setup import setup_manager
from app.schemas.setup import (
    FactoryResetRequest,
    InitializeRequest,
    InitializeResponse,
    SetupStatusResponse,
    UpdateGeminiKeyRequest,
)

logger = logging.getLogger("setup_api")

router = APIRouter(prefix="/api/setup", tags=["Setup"])


@router.get(
    "/status",
    response_model=SetupStatusResponse,
    summary="Check Setup Status",
    description="Returns whether the application requires first-time setup or is active.",
)
async def get_setup_status() -> SetupStatusResponse:
    summary = setup_manager.get_state_summary()
    return SetupStatusResponse(**summary)


@router.post(
    "/initialize",
    response_model=InitializeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="First-Time Setup Initialization",
    description=(
        "Validates Owner Email, Owner Password, Gemini API Key, and DB settings, "
        "writes the configuration, and sets state to ACTIVE."
    ),
)
async def initialize_system(req: InitializeRequest) -> InitializeResponse:
    if setup_manager.is_active():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="System is already initialized. Use factory reset if you need to reconfigure.",
        )

    try:
        result = await setup_manager.initialize(req)
        return InitializeResponse(**result)
    except ValueError as val_err:
        logger.warning(f"Initialization validation failed: {val_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        logger.error(f"Unexpected error during initialization: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred while initializing system.",
        )


@router.post(
    "/factory-reset",
    summary="Factory Reset",
    description="Resets the instance to factory state. Protected by the Owner master password.",
)
async def factory_reset_system(req: FactoryResetRequest):
    if not setup_manager.is_active():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is not currently initialized.",
        )

    try:
        result = setup_manager.factory_reset(
            owner_password=req.owner_password,
            wipe_database=req.wipe_database,
        )
        return result
    except PermissionError as perm_err:
        logger.warning(f"Factory reset unauthorized attempt: {perm_err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Owner master password.",
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        logger.error(f"Unexpected error during factory reset: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred during factory reset.",
        )


@router.post(
    "/gemini-key",
    summary="Update Gemini API Key",
    description="Update the Google Gemini API Key. Protected by Owner master password.",
)
async def update_gemini_api_key(req: UpdateGeminiKeyRequest):
    if not setup_manager.is_active():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System is not currently initialized.",
        )

    try:
        result = await setup_manager.update_gemini_api_key(
            owner_password=req.owner_password,
            new_api_key=req.gemini_api_key,
            validate_external=req.validate_external,
        )
        return result
    except PermissionError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Owner master password.",
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        logger.error(f"Unexpected error updating Gemini key: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error occurred while updating Gemini API key.",
        )
