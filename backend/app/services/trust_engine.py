from app.database import supabase

def calculate_trust_score(vendor_id: str) -> float:
    # 1. Checklist Score (40% weight)
    # Total questions = 18
    checklist_res = supabase.table("checklist_answers").select("answer").eq("vendor_id", vendor_id).execute()
    yes_count = sum(1 for item in checklist_res.data if item["answer"] is True)
    checklist_pct = (yes_count / 18) * 40 if checklist_res.data else 0

    # 2. Image Score (40% weight)
    # Max 5 types
    images_res = supabase.table("proof_images").select("image_type").eq("vendor_id", vendor_id).eq("is_current", True).execute()
    uploaded_count = len(set(item["image_type"] for item in images_res.data))
    image_pct = (uploaded_count / 5) * 40

    # 3. Freshness Score (20% weight)
    vendor_res = supabase.table("vendors").select("active").eq("id", vendor_id).execute()
    is_active = vendor_res.data[0]["active"] if vendor_res.data else False
    freshness_pct = 20 if is_active else 0

    final_score = round(checklist_pct + image_pct + freshness_pct, 2)

    # Update the score in the database
    supabase.table("vendors").update({"trust_score": final_score}).eq("id", vendor_id).execute()

    return final_score

def get_trust_level(score: float) -> str:
    if score >= 90:
        return "Excellent"
    elif score >= 70:
        return "Good"
    elif score >= 50:
        return "Average"
    else:
        return "Poor"
