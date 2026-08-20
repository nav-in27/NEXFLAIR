from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import User, UserRole
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user, require_role

router = APIRouter()

@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticates user credentials and returns a JWT access token.
    Never returns or accepts plaintext passwords outside authentication.
    """
    email_clean = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email_clean).first()
    
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is deactivated."
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Returns the authenticated user's profile."""
    return UserResponse.model_validate(current_user)

@router.get("/admin-only")
async def admin_only_endpoint(
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Route restricted exclusively to users with ADMIN role."""
    return {"message": "Welcome Admin", "user_id": current_user.id}
