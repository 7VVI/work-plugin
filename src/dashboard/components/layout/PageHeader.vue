<template>
  <div class="page-header">
    <div class="brand">
      <div class="brand-logo">D</div>
      <span class="brand-name">Dock</span>
      <span class="brand-sub">管理面板</span>
    </div>
    <div class="header-actions">
      <div class="icon-btn" @click="$router.push('/settings')" title="设置">
        <i class="fa-solid fa-gear"></i>
      </div>
      <div class="user-avatar">A</div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.page-header {
  height: var(--header-h);
  background: var(--header-bg);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--page-pad);
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-logo {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  font-family: "SF Pro Display", -apple-system, sans-serif;
  letter-spacing: -0.5px;
}
.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}
.brand-sub {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  padding: 3px 8px;
  background: var(--border-soft);
  border-radius: 5px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
}
.icon-btn:hover { background: var(--border-soft); color: var(--text-primary); }
.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--text-secondary) 0%, var(--text-primary) 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  margin-left: 4px;
  cursor: pointer;
}
</style>
