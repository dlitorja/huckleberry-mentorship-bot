# Image Assets Page - Testing Checklist

**Page URL:** `/assets`  
**Access:** Admin only

---

## ✅ **Pre-Testing Setup**

- [ ] Verify Supabase storage bucket `landing-page-assets` exists
- [ ] Verify bucket is set to public (for direct URL access)
- [ ] Verify you're logged in as an admin user
- [ ] Check browser console for any errors

---

## 🔐 **Authentication & Authorization Tests**

- [ ] **Non-authenticated user:**
  - [ ] Navigate to `/assets` while logged out
  - [ ] Should redirect to `/login?callbackUrl=/assets`
  - [ ] After login, should redirect back to `/assets`

- [ ] **Non-admin user (student/instructor):**
  - [ ] Log in as a non-admin Discord account
  - [ ] Navigate to `/assets`
  - [ ] Should redirect to `/dashboard` with no access

- [ ] **Admin user:**
  - [ ] Log in as admin
  - [ ] Navigate to `/assets`
  - [ ] Should see the assets page

---

## 📤 **Upload Functionality Tests**

### **Drag & Drop:**
- [ ] Drag a single image file onto the upload area
  - [ ] Visual feedback (border color change) when dragging
  - [ ] File appears in "Selected Files" list
  - [ ] File name and size are displayed correctly
- [ ] Drag multiple image files (2-5 files)
  - [ ] All files appear in the list
  - [ ] Can remove individual files before uploading
- [ ] Drag a non-image file (e.g., PDF, text file)
  - [ ] File should be rejected/filtered out
  - [ ] No error message needed (silent rejection is fine)

### **Click to Browse:**
- [ ] Click the upload area
  - [ ] File picker opens
  - [ ] Can select single image
  - [ ] Can select multiple images (Ctrl/Cmd + click)
- [ ] Select non-image files
  - [ ] Should be filtered out (only images selectable if `accept="image/*"` works)

### **File Validation:**
- [ ] Upload a file larger than 10MB
  - [ ] Should show error: "File too large (max 10MB)"
  - [ ] Upload should fail
- [ ] Upload a valid image (PNG, JPG, WebP, GIF, SVG)
  - [ ] Should upload successfully
  - [ ] Success message appears
  - [ ] Image appears in the grid below

### **Upload Process:**
- [ ] Select 1-3 images and click "Upload"
  - [ ] Button shows "Uploading..." with spinner
  - [ ] Button is disabled during upload
  - [ ] After success, files list clears
  - [ ] Images appear in the grid
  - [ ] Success alert shows correct count
- [ ] Upload multiple files (5-10)
  - [ ] All should upload successfully
  - [ ] All appear in grid
- [ ] Test with different image formats:
  - [ ] PNG
  - [ ] JPG/JPEG
  - [ ] WebP
  - [ ] GIF
  - [ ] SVG

### **Error Handling:**
- [ ] Test with network disconnected (simulate failure)
  - [ ] Error message appears
  - [ ] Files remain in "Selected Files" for retry
- [ ] Test with invalid file (if validation fails)
  - [ ] Appropriate error message

---

## 📋 **Asset List Display Tests**

- [ ] **Empty state:**
  - [ ] When no images uploaded, shows "No images uploaded yet" message
  - [ ] Icon displays correctly

- [ ] **Grid display:**
  - [ ] Images display in responsive grid (1 col mobile, 2-3 cols desktop)
  - [ ] Images load correctly (no broken images)
  - [ ] Image aspect ratio maintained
  - [ ] File name displays (truncated if too long)
  - [ ] File size displays correctly (KB/MB format)
  - [ ] Upload date displays correctly

- [ ] **Sorting:**
  - [ ] Newest images appear first (most recent at top)
  - [ ] After uploading, new images appear at top of list

---

## 📋 **URL Copying Tests**

- [ ] Click copy button on an image
  - [ ] Button icon changes to checkmark (✓)
  - [ ] URL is copied to clipboard
  - [ ] Paste in another tab/window to verify URL works
  - [ ] URL is publicly accessible (no auth required)
  - [ ] Checkmark reverts to copy icon after 2 seconds

- [ ] Test copied URL:
  - [ ] Paste URL in browser address bar
  - [ ] Image loads directly
  - [ ] URL can be used in Kajabi (test if possible)

- [ ] Test with multiple images:
  - [ ] Copy URL from different images
  - [ ] Each URL is unique and correct

---

## 🗑️ **Delete Functionality Tests**

- [ ] Click delete button (X icon) on an image
  - [ ] Confirmation dialog appears: "Are you sure you want to delete this image?"
  - [ ] Click "Cancel" → image remains
  - [ ] Click "OK" → image is deleted
  - [ ] Image disappears from grid immediately
  - [ ] Image is actually deleted from Supabase Storage (verify in Supabase dashboard)

- [ ] Delete multiple images:
  - [ ] Delete 2-3 images in sequence
  - [ ] All are removed from grid
  - [ ] All are removed from storage

- [ ] Test error handling:
  - [ ] If delete fails (simulate), error message appears
  - [ ] Image remains in grid if delete fails

---

## 🔄 **Refresh & Reload Tests**

- [ ] Upload an image, then refresh the page
  - [ ] Image still appears in grid
  - [ ] All metadata (name, size, date) is correct

- [ ] Delete an image, then refresh the page
  - [ ] Image does not reappear
  - [ ] Deletion is persistent

- [ ] Open page in multiple tabs:
  - [ ] Upload in one tab
  - [ ] Refresh other tab
  - [ ] New image appears (or test real-time update if implemented)

---

## 📱 **Responsive Design Tests**

- [ ] **Mobile (phone):**
  - [ ] Page is usable on small screen
  - [ ] Grid shows 1 column
  - [ ] Upload area is accessible
  - [ ] Buttons are tappable
  - [ ] Text is readable

- [ ] **Tablet:**
  - [ ] Grid shows 2 columns
  - [ ] Layout is optimized

- [ ] **Desktop:**
  - [ ] Grid shows 3 columns
  - [ ] Full width utilized well

---

## 🎨 **UI/UX Tests**

- [ ] **Dark mode:**
  - [ ] Toggle dark mode
  - [ ] All colors/text are readable
  - [ ] Images display correctly

- [ ] **Loading states:**
  - [ ] Initial page load shows spinner
  - [ ] Upload button shows spinner during upload
  - [ ] No flickering or layout shifts

- [ ] **Visual feedback:**
  - [ ] Drag area highlights when dragging
  - [ ] Copy button shows checkmark when clicked
  - [ ] Delete button has hover state

---

## 🐛 **Edge Cases & Stress Tests**

- [ ] Upload 20+ images at once
  - [ ] All upload successfully
  - [ ] Grid displays all images
  - [ ] Page performance is acceptable

- [ ] Upload very large image (close to 10MB limit)
  - [ ] Uploads successfully
  - [ ] Image displays correctly

- [ ] Upload image with special characters in filename
  - [ ] Filename is sanitized correctly
  - [ ] Image uploads and displays

- [ ] Upload same image twice
  - [ ] Both uploads succeed (different IDs)
  - [ ] Both appear in grid

- [ ] Test with very long filename
  - [ ] Filename is truncated in display
  - [ ] Full filename preserved in storage

- [ ] Test rapid clicking (upload button, copy, delete)
  - [ ] No duplicate actions
  - [ ] No errors

---

## 🔍 **Browser Console Checks**

- [ ] Open browser DevTools console
- [ ] Perform all operations above
- [ ] Check for:
  - [ ] No JavaScript errors
  - [ ] No network errors (404, 500, etc.)
  - [ ] No CORS errors
  - [ ] No authentication errors

---

## ✅ **Final Verification**

- [ ] All images uploaded are accessible via their URLs
- [ ] URLs work when pasted into Kajabi (if possible to test)
- [ ] Deleted images are actually removed from Supabase Storage
- [ ] No orphaned files in storage bucket
- [ ] Page works consistently across different browsers (Chrome, Firefox, Safari, Edge)

---

## 📝 **Notes & Issues Found**

_Use this section to document any bugs, issues, or improvements needed:_

- Issue 1: [Description]
- Issue 2: [Description]
- etc.

---

## 🎯 **Success Criteria**

The assets page is considered **fully tested** when:
- ✅ All authentication/authorization tests pass
- ✅ Upload works for all supported image formats
- ✅ URLs can be copied and used externally
- ✅ Delete functionality works correctly
- ✅ No console errors
- ✅ Responsive design works on all screen sizes
- ✅ All edge cases handled gracefully

